import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../EnvironmentSettings.js';
import { TaskStatus } from '../enums/TaskStatus.js';
import { BaseTask } from '../models/BaseTask.js';
import { TaskChannel } from '../models/TaskChannel.js';
import { PromisedSettledResultStatus } from '../../../enums/PromisedSettledResultStatus.js';

export class TaskQueue {
    #environmentSettings: EnvironmentSettings;

    #channels: Array<TaskChannel> = [];
    #isActive = false;

    #logger;

    get isActive() {
        return this.#isActive;
    }

    constructor(environmentSettings: EnvironmentSettings) {
        this.#environmentSettings = environmentSettings;
        this.#logger = new Logger(environmentSettings.isProduction, 'TaskQueue');
    }

    async add(task: BaseTask): Promise<void> {
        this.#logger(LogLevel.Info, `Adding a task to the ${task.taskChannel} queue.`);

        if(this.#channels.filter(x => x.name === task.taskChannel).length === 0) {
            const newChannel = new TaskChannel(this.#environmentSettings, task.taskChannel);
            newChannel.queue.push(task);
            this.#channels.push(newChannel);
        } else {
            const taskChannel = this.#channels.find(x => x.name === task.taskChannel);
            taskChannel.queue.push(task);
        }

        await this.#processQueue();
    }

    async #processQueue(): Promise<void> {
        if(this.#isActive) {
            return;
        }

        let tasks = this.#getNextTasks();

        while(tasks.length > 0) {
            this.#isActive = true;
            this.#logger(LogLevel.Info, `Processing the task queue with ${this.#channels.length} channels and`
                + `${this.#channels.map((channel, i, channels) => channels.length)
                    .reduce((previousValue, currentValue) => previousValue + currentValue)}`
                + `tasks.`);

            try {
                const processPromises = tasks.map(x => x.process());
                const processPromisesResults = await Promise.allSettled(processPromises);

                const postProcessingPromises = processPromisesResults.map((promise, i) => {
                    const task = tasks[i];

                    if(promise.status === PromisedSettledResultStatus.Fulfilled) {
                        return task.postProcess();
                    }

                    if(promise.status === PromisedSettledResultStatus.Rejected) {
                        this.#logger(LogLevel.Error, `A task was rejected ${task.numAttempts} time(s): ${promise.reason}`);
                        task.taskStatus = TaskStatus.Failed;

                        if(task.numAttempts === this.#environmentSettings.maxTaskAttempts) {
                            return task.postProcess();
                        }
                    }
                });

                await Promise.allSettled(postProcessingPromises);
            } catch(error) {
                this.#logger(LogLevel.Error, `An exception occurred while processing a task: ${error}`);
            }

            tasks = this.#getNextTasks();
        }

        this.#isActive = false;
    }

    #getNextTasks(): Array<BaseTask> {
        this.#logger(LogLevel.Info, 'Retrieving the next task...');

        this.#cleanChannels();

        const tasks = this.#channels.filter(channel => channel.queue.length > 0)
            .map(channel => channel.queue[0]);

        return tasks;
    }

    #cleanChannels() {
        this.#channels.forEach(channel => {
            channel.cleanQueue();
        });
    }
}
