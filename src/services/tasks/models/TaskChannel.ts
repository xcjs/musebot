import { Logger, LogLevel } from 'meklog';

import { BaseTask } from './BaseTask';
import { EnvironmentSettings } from '../../EnvironmentSettings';
import { TaskStatus } from '../enums/TaskStatus';

export class TaskChannel {
    #environmentSettings: EnvironmentSettings;

    #name: string;
    #queue: Array<BaseTask> = [];

    #logger;

    get name(): string {
        return this.#name;
    }

    get queue(): Array<BaseTask> {
        return this.#queue;
    }

    constructor(environmentSettings: EnvironmentSettings, name: string) {
        this.#environmentSettings = environmentSettings;
        this.#name = name;

        this.#logger = new Logger(environmentSettings.isProduction, 'TaskQueue');
    }

    cleanQueue(): void {
        this.#logger(LogLevel.Info, 'Removing completed or failed entries from a queue...');

        const incompleteTasks = this.#queue.filter(task => {
            if(task.taskStatus === TaskStatus.Idle
                || task.taskStatus === TaskStatus.Busy
                || (task.taskStatus === TaskStatus.Failed
                    && task.numAttempts <= this.#environmentSettings.maxTaskAttempts)) {
                        return task;
            }
        });

        const failedTasks = incompleteTasks.filter(
            x => x.taskStatus === TaskStatus.Failed && x.numAttempts <= this.#environmentSettings.maxTaskAttempts)
            .sort(this.#compareByDate);

        const nonFailedTasks = incompleteTasks.filter(
            x => x.taskStatus !== TaskStatus.Failed && x.taskStatus !== TaskStatus.Complete)
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
