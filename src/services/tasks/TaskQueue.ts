import { Logger, LogLevel } from 'meklog';

import { TaskStatus } from 'services/tasks/enums/TaskStatus.js';
import { BaseTask } from 'services/tasks/models/BaseTask.js';
import { TaskChannel } from 'services/tasks/models/TaskChannel.js';
import { PromisedSettledResultStatus } from 'enums/PromisedSettledResultStatus.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings.js';

export class TaskQueue {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;

    #logger;

    #channels: Array<TaskChannel> = [];
    #isActive: boolean = false;

    get isActive() {
        return this.#isActive;
    }

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#environmentSettings = services.environmentSettings;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'TaskQueue');
    }

    async add(task: BaseTask): Promise<void> {
        this.#logger(LogLevel.Info, `Adding a task to the ${task.taskChannel} queue.`);

        let taskChannel: TaskChannel;

        if(this.#channels.filter(x => x.name === task.taskChannel).length === 0) {
            taskChannel = new TaskChannel(this.#services, task.taskChannel);
            this.#channels.push(taskChannel);
        } else {
            taskChannel = this.#channels.find(x => x.name === task.taskChannel);
        }

        taskChannel.queue.push(task);

        this.#processQueue();
    }

    async #processQueue(): Promise<void> {
        let tasks = this.#getNextTasks();

        while(tasks.length > 0) {
            this.#logger(LogLevel.Info, `Processing the task queue with ${this.#channels.length} channel(s) and`
                + ` ${this.#channels.map((channel, i, channels) => channels.length)
                    .reduce((previousValue, currentValue) => previousValue + currentValue)}`
                + ` task(s).`);

            try {
                const processPromises = tasks.map((x) => {
                    x.taskStatus = TaskStatus.Busy;
                    return x.process()
                });

                const processPromisesResults = await Promise.allSettled(processPromises);

                const postProcessingPromises = processPromisesResults.map((promise, i) => {
                    const task = tasks[i];

                    if(promise.status === PromisedSettledResultStatus.Fulfilled) {
                        task.taskStatus = TaskStatus.Successful;
                        return task.postProcess();
                    }

                    if(promise.status === PromisedSettledResultStatus.Rejected) {
                        task.taskStatus = TaskStatus.Failed;
                        this.#logger(LogLevel.Error, `A task was rejected ${task.numAttempts} time(s): ${promise.reason}`);

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
    }

    #getNextTasks(): Array<BaseTask> {
        this.#logger(LogLevel.Info, 'Retrieving the next task...');

        this.#cleanChannels();

        const tasks = this.#channels
            .filter(channel => channel.queue.length > 0 && !channel.isActive)
            .map(channel => channel.queue[0]);

        this.#isActive = this.#channels.filter(channel => channel.hasTasks).length > 0;

        return tasks;
    }

    #cleanChannels() {
        this.#channels.forEach(channel => {
            channel.cleanQueue();
        });
    }
}
