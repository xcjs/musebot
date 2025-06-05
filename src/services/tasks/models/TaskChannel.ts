import { ILogger } from '../../ILogger.js';
import { IServiceContainer } from '../../IServiceContainer.js';
import { TaskStatus } from '../enums/TaskStatus.js';
import { BaseTask } from './BaseTask.js';

export class TaskChannel {
    #name: string;
    #queue: Array<BaseTask> = [];

    #logger: ILogger;

    get name(): string {
        return this.#name;
    }

    get queue(): Array<BaseTask> {
        return this.#queue;
    }

    get isActive(): boolean {
        const numBusyTasks = this.#queue.filter(x => x.taskStatus === TaskStatus.Busy).length;

        this.#logger.debug(`The ${this.name} task channel has ${numBusyTasks} busy task(s).`);
        return numBusyTasks > 0;
    }

    get hasTasks(): boolean {
        this.#logger.debug(`The ${this.name} task channel has ${this.queue.length} task(s) left.`);
        return this.#queue.length > 0;
    }

    constructor(services: IServiceContainer, name: string) {
        this.#name = name;

        this.#logger = services.getLogger('TaskChannel');

        this.#logger.info(`Created a new task channel called ${name}.`);
    }

    cleanQueue(): void {
        this.#logger.info(`Removing completed or dead entries from the ${this.#name} channel...`);

        const incompleteTasks = this.#queue.filter(task => {
            if (task.taskStatus === TaskStatus.Idle
                || task.taskStatus === TaskStatus.Busy
                || task.taskStatus === TaskStatus.Delayed
                || task.taskStatus === TaskStatus.Failed) {
                return task;
            }
        });

        const failedTasks = incompleteTasks.filter(
            x => x.taskStatus === TaskStatus.Failed || x.taskStatus === TaskStatus.Delayed)
            // eslint-disable-next-line @typescript-eslint/unbound-method
            .sort(this.#compareByDate);

        const nonFailedTasks = incompleteTasks.filter(
            x => x.taskStatus !== TaskStatus.Failed && x.taskStatus !== TaskStatus.Delayed)
            // eslint-disable-next-line @typescript-eslint/unbound-method
            .sort(this.#compareByDate);

        this.#queue = [];

        nonFailedTasks.concat(failedTasks).forEach((task) => {
            if(this.#queue.find(queueTask => queueTask.id === task.id) === undefined) {
                this.#queue.push(task);
            }
        });
    }

    #compareByDate(a: BaseTask, b: BaseTask): number {
        if (a.createdTime < b.createdTime) {
            return -1;
        } else {
            return 1;
        }
    }
}
