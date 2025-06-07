import { PromisedSettledResultStatus } from '../../enums/PromisedSettledResultStatus.js';
import { IEnvironmentSettings } from '../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../ILogger.js';
import { IServiceContainer } from '../IServiceContainer.js';
import { TaskStatus } from './enums/TaskStatus.js';
import { ITaskQueue } from './ITaskQueue.js';
import { BaseTask } from './models/BaseTask.js';
import { TaskChannel } from './models/TaskChannel.js';

export class TaskQueue implements ITaskQueue {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;

    #logger: ILogger;

    #channels: Array<TaskChannel> = [];

    get isActive() {
        return this.#channels.filter(channel => channel.hasTasks).length > 0;
    }

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#logger = services.getLogger('TaskQueue');
    }

    add(task: BaseTask<unknown>): void {
        this.#logger.info(`Adding task ${task.id} to the ${task.taskChannel} queue.`);

        let taskChannel: TaskChannel;

        if (this.#channels.filter(x => x.name === task.taskChannel).length === 0) {
            taskChannel = new TaskChannel(this.#services, task.taskChannel);
            this.#channels.push(taskChannel);
        } else {
            taskChannel = this.#channels.find(x => x.name === task.taskChannel);
        }

        if (taskChannel.queue.find(x => x.id === task.id) === undefined) {
            taskChannel.queue.push(task);
        }

        // Not awaited intentionally - this allows tasks of different channels
        // to be processed in parallel.
        void this.#processQueue();
    }

    async #processQueue(): Promise<void> {
        let tasks = this.#getNextTasks();

        while (tasks.length > 0) {
            const numChannels = this.#channels.length;
            const numTasks = this.#channels.map((channel) => channel.queue.length)
                .reduce((accumulator, value) => accumulator + value);

            this.#logger.info(`Processing the task queue with ${numChannels} channel(s) and ${numTasks} task(s).`);

            try {
                const processPromises = tasks
                    .filter(x => x.taskStatus !== TaskStatus.Delayed)
                    .map((x) => {
                        x.taskStatus = TaskStatus.Busy;
                        return x.process();
                    });

                const processPromisesResults = await Promise.allSettled(processPromises);

                const postProcessingPromises = processPromisesResults.map((promise, i) => {
                    const task = tasks[i];

                    if (promise.status === PromisedSettledResultStatus.Fulfilled) {
                        task.taskStatus = TaskStatus.Successful;
                        return task.postProcess();
                    }

                    if (promise.status === PromisedSettledResultStatus.Rejected.toString()) {
                        task.taskStatus = TaskStatus.Failed;
                        this.#logger.error(`Task ${task.id} was rejected ${task.numAttempts} time(s): ${promise.reason}`);

                        if (task.numAttempts >= this.#environmentSettings.maxTaskAttempts) {
                            return task.postProcess();
                        }
                    }
                });

                await Promise.allSettled(postProcessingPromises);
            } catch (error) {
                this.#logger.error(`An exception occurred while processing a task: ${error}`);
            }

            tasks = this.#getNextTasks();
        }
    }

    #getNextTasks(): BaseTask<unknown>[] {
        this.#logger.info('Retrieving the next tasks...');

        this.#cleanChannels();

        const tasks = this.#channels
            .filter(channel => channel.queue.length > 0 && !channel.isActive)
            .map(channel => channel.queue[0]);

        tasks.forEach((task) => {
            this.#logger.info(`Adding task ${task.id} to the queue from ${task.taskChannel}.`);
        });

        return tasks;
    }

    #cleanChannels() {
        this.#channels.forEach(channel => {
            channel.cleanQueue();
        });
    }
}
