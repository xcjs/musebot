import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../IServiceContainer.js';
import { TaskStatus } from '../enums/TaskStatus.js';
import { BaseTask } from './BaseTask.js';

export class TaskChannel {
    #environmentSettings: IEnvironmentSettings;

    #name: string;
    #queue: Array<BaseTask> = [];

    #logger;

    get name(): string {
        return this.#name;
    }

    get queue(): Array<BaseTask> {
        return this.#queue;
    }

    get isActive(): boolean {
        return this.#queue.filter(x => x.taskStatus === TaskStatus.Busy).length > 0;
    }

    get hasTasks(): boolean {
        return this.#queue.length > 0;
    }

    constructor(services: IServiceContainer, name: string) {
        this.#environmentSettings = services.environmentSettings;
        this.#name = name;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'TaskChannel');

        this.#logger(LogLevel.Info, `Created a new task channel called ${name}.`);
    }

    cleanQueue(): void {
        this.#logger(LogLevel.Info, 'Removing completed or failed entries from a queue...');

        const incompleteTasks = this.#queue.filter(task => {
            if(task.taskStatus === TaskStatus.Idle
                || task.taskStatus === TaskStatus.Busy
                || task.taskStatus === TaskStatus.Failed) {
                    return task;
            }
        });

        const failedTasks = incompleteTasks.filter(
            x => x.taskStatus === TaskStatus.Failed)
            .sort(this.#compareByDate);

        const nonFailedTasks = incompleteTasks.filter(
            x => x.taskStatus !== TaskStatus.Failed)
            .sort(this.#compareByDate);

        this.#queue = nonFailedTasks.concat(failedTasks);
    }

    #compareByDate(a: BaseTask, b: BaseTask): number {
        if(a.createdTime < b.createdTime) {
            return -1;
        } else {
            return 1;
        }
    }
}
