import { ILogger } from '../../ILogger.js';
import { IServiceContainer } from '../../IServiceContainer.js';
import { TaskStatus } from '../enums/TaskStatus.js';
import { BaseTask } from './BaseTask.js';

export class TaskChannel {
    #logger: ILogger;

    #name: string;
    #queue: BaseTask<unknown>[] = [];

    get name(): string {
        return this.#name;
    }

    get queue(): BaseTask<unknown>[] {
        return this.#queue;
    }

    get isActive(): boolean {
        const numBusyTasks = this.#queue.filter(x => x.taskStatus === TaskStatus.Busy).length;
        return numBusyTasks > 0;
    }

    get hasTasks(): boolean {
        return this.#queue.length > 0;
    }

    constructor(services: IServiceContainer, name: string) {
        this.#logger = services.getLogger('TaskChannel');

        this.#name = name;

        this.#logger.info(`Created a new task channel called ${name}.`);
    }

    cleanQueue(): void {
        this.#logger.info(`Removing completed or dead entries from the ${this.#name} channel...`);

        const incompleteTasks = this.#queue.filter(task => {
            if (task.taskStatus === TaskStatus.Idle
                || task.taskStatus === TaskStatus.Busy) {
                return task;
            }
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.#queue = incompleteTasks.sort(this.#compareByDate);
    }

    #compareByDate(a: BaseTask<unknown>, b: BaseTask<unknown>): number {
        if (a.createdTime < b.createdTime) {
            return -1;
        } else {
            return 1;
        }
    }
}
