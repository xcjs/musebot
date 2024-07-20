import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../EnvironmentSettings.js';
import { TaskStatus } from '../enums/TaskStatus.js';
import { BaseTask } from '../models/BaseTask.js';

export class TaskQueue {
    #queue: Array<BaseTask> = [];
    #maxTaskAttempts: 100;
    #active = false;

    #logger;

    constructor(environmentSettings: EnvironmentSettings) {
        this.#logger = new Logger(environmentSettings.isProduction, 'TaskQueue');
    }

    async add(task: BaseTask): Promise<void> {
        this.#logger(LogLevel.Info, 'Adding a task to the task queue.');

        this.#queue.push(task);
        await this.#processQueue();
    }

    async #processQueue(): Promise<void> {
        if(this.#active) {
            return;
        }

        let task: BaseTask = this.#getNextTask();

        while(task !== null) {
            this.#active = true;

            this.#logger(LogLevel.Info, `Processing the task queue. This task has been attempted ${task.numAttempts} time(s).`);

            await (task.process());
            task = this.#getNextTask();
        }

        this.#active = false;
    }

    #getNextTask(): BaseTask | null {
        this.#logger(LogLevel.Info, 'Retrieving the next task...');

        this.#cleanQueue();

        if(this.#queue.length === 0) {
            return null;
        }

        return this.#queue[0];
    }

    // TODO: Move failed jobs to the end of the queue. Also add timestamps to the beginning and end of a job.
    #cleanQueue(): void {
        this.#logger(LogLevel.Info, 'Removing completed or failed entries from the queue...');

        this.#queue = this.#queue.filter(task => {
            if(task.taskStatus === TaskStatus.Idle
                || task.taskStatus === TaskStatus.Busy
                || (task.taskStatus === TaskStatus.Failed
                    && task.numAttempts < this.#maxTaskAttempts)) {
                        return task;
            }
        });
    }
}
