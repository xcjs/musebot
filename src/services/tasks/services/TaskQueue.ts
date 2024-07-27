import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../EnvironmentSettings.js';
import { TaskStatus } from '../enums/TaskStatus.js';
import { BaseTask } from '../models/BaseTask.js';
import { TaskType } from '../enums/TaskType.js';

export class TaskQueue {
    #queue: Array<BaseTask> = [];
    #maxTaskAttempts: 100;
    #isActive = false;

    #logger;

    get isActive() {
        return this.#isActive;
    }

    constructor(environmentSettings: EnvironmentSettings) {
        this.#logger = new Logger(environmentSettings.isProduction, 'TaskQueue');
    }

    async add(task: BaseTask): Promise<void> {
        this.#logger(LogLevel.Info, 'Adding a task to the task queue.');

        if(task.taskType === TaskType.Instant) {
            this.#logger(LogLevel.Info, 'The task type is instant and will process immediately.');
            await task.process();
        } else {
            this.#queue.push(task);
        }

        await this.#processQueue();
    }

    async #processQueue(): Promise<void> {
        if(this.#isActive) {
            return;
        }

        let task: BaseTask = this.#getNextTask();

        while(task !== null) {
            this.#isActive = true;

            this.#logger(LogLevel.Info, `Processing the task queue. This task has been attempted ${task.numAttempts} time(s).`);

            try {
                await task.process();
            } catch(error) {
                this.#logger(LogLevel.Error, `An exception occurred while processing a ${typeof task} task: ${error}`);
                task.taskStatus = TaskStatus.Failed;
            }

            task = this.#getNextTask();
        }

        this.#isActive = false;
    }

    #getNextTask(): BaseTask | null {
        this.#logger(LogLevel.Info, 'Retrieving the next task...');

        this.#cleanQueue();

        if(this.#queue.length === 0) {
            return null;
        }

        return this.#queue[0];
    }

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

        const failedTasks = this.#queue.filter(x => x.taskStatus === TaskStatus.Failed && x.numAttempts < this.#maxTaskAttempts)
            .sort(this.#compareByDate);

        const otherTasks = this.#queue.filter(x => x.taskStatus !== TaskStatus.Failed)
            .sort(this.#compareByDate);

        this.#queue = otherTasks.concat(failedTasks);
    }

    #compareByDate(a: BaseTask, b: BaseTask): number {
        if(a.createdTime < b.createdTime) {
            return -1;
        } else {
            return 1;
        }
    }
}
