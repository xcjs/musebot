import { PromisedSettledResultStatus } from '../../enums/PromisedSettledResultStatus.js';
import { IBotServiceContainer } from '../IBotServiceContainer.js';
import { IGlobalServiceContainer } from '../IGlobalServiceContainer.js';
import { TaskStatus } from './enums/TaskStatus.js';
import { ITaskQueue } from './ITaskQueue.js';
import { BaseTask } from './models/BaseTask.js';
import { TaskChannel } from './models/TaskChannel.js';

export class TaskQueue implements ITaskQueue {
    readonly #globalServices: IGlobalServiceContainer;
    readonly #channels: TaskChannel[] = [];

    constructor(globalServices: IGlobalServiceContainer) {
        this.#globalServices = globalServices;
    }

    get isActive(): boolean {
        return this.#channels.some(channel => channel.isActive);
    }

    add(task: BaseTask<unknown>): void {
        this.#globalServices.getLogger('TaskQueue').info(`Adding task ${task.id} to the ${task.taskChannel} queue.`);

        let taskChannel: TaskChannel;
        const taskServices = this.#getTaskServices(task);

        if (this.#channels.filter(x => x.name === task.taskChannel).length === 0) {
            taskChannel = new TaskChannel(taskServices, task.taskChannel);
            this.#channels.push(taskChannel);
        } else {
            const potentialTaskChannel = this.#channels.find(x => x.name === task.taskChannel);

            if(potentialTaskChannel === undefined) {
                taskChannel = new TaskChannel(taskServices, task.taskChannel);
            } else {
                taskChannel = potentialTaskChannel;
            }
        }

        if (!taskChannel.queue.some(x => x.id === task.id)) {
            taskChannel.queue.push(task);
        }

        // Not awaited intentionally - this allows tasks of different channels
        // to be processed in parallel.
        void this.#processQueue();
    }

    #getTaskServices(task: BaseTask<unknown>): IBotServiceContainer {
        // Access the private services field via type assertion
        return (task as unknown as { services: IBotServiceContainer }).services;
    }

    async #processQueue(): Promise<void> {
        let tasks = this.#getNextTasks();

        while (tasks.length > 0) {
            const numChannels = this.#channels.length;
            const numTasks = this.#channels.map((channel) => channel.queue.length)
                .reduce((accumulator, value) => accumulator + value);

            this.#globalServices.getLogger('TaskQueue').info(`Processing the task queue with ${numChannels} channel(s) and ${numTasks} task(s).`);

            try {
                const preProcessPromises = tasks
                    .map((x) => {
                        return x.preProcess();
                    });

                await Promise.allSettled(preProcessPromises);

                const processPromises = tasks
                    .map((x) => {
                        x.taskStatus = TaskStatus.Busy;
                        return x.process();
                    });

                const processPromisesResults = await Promise.allSettled(processPromises);

                const postProcessingPromises = processPromisesResults.map((promise, i) => {
                    const task = tasks[i];

                    if (promise.status === PromisedSettledResultStatus.Fulfilled.toString()) {
                        task.taskStatus = TaskStatus.Successful;
                        return task.postProcess();
                    }

                    if (promise.status === PromisedSettledResultStatus.Rejected.toString()) {
                        task.taskStatus = TaskStatus.Failed;
                        this.#globalServices.getLogger('TaskQueue').error(`Task ${task.id} was rejected ${task.numAttempts} time(s):`, task,
                            (promise as PromiseRejectedResult).reason);

                        if (task.numAttempts >= this.#globalServices.globalConfiguration.taskQueue.numAttempts) {
                            const reason: unknown = (promise as PromiseRejectedResult).reason;
                            task.lastError = reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : '[object Object]');
                            return task.postProcess();
                        } else {
                            this.#globalServices.getLogger('TaskQueue').info('Scheduling a failed task to be resumed:', task.id);

                            setTimeout(() => {
                                task.taskStatus = TaskStatus.Idle;
                                this.add(task);
                            }, this.#globalServices.globalConfiguration.taskQueue.retryDelayMs);
                        }
                    }
                });

                await Promise.allSettled(postProcessingPromises);
            } catch (error) {
                this.#globalServices.getLogger('TaskQueue').error('An exception occurred while processing a task:', error);
            }

            tasks = this.#getNextTasks();
        }
    }

    #getNextTasks(): BaseTask<unknown>[] {
        this.#globalServices.getLogger('TaskQueue').info('Retrieving the next tasks...');

        this.#cleanChannels();

        const tasks = this.#channels
            .filter(channel => channel.queue.length > 0 && !channel.isActive)
            .map(channel => channel.queue[0]);

        tasks.forEach((task) => {
            this.#globalServices.getLogger('TaskQueue').info(`Adding task ${task.id} to the queue from ${task.taskChannel}.`);
        });

        return tasks;
    }

    #cleanChannels(): void {
        this.#channels.forEach(channel => {
            channel.cleanQueue();
        });
    }
}
