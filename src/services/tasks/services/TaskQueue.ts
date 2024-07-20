import { TaskStatus } from '../enums/TaskStatus.js';
import { BaseTask } from '../models/BaseTask.js';

export class TaskQueue {
    #queue: Array<BaseTask> = [];
    #maxTaskAttempts: 100;

    constructor() {

    }

    add(task: BaseTask): void {
        this.#queue.push(task);
    }

    processQueue(): void {

    }

    cleanQueue(): void {
        this.#queue = this.#queue.filter(task => {
            if(task.taskStatus !== TaskStatus.Successful
                || (task.taskStatus === TaskStatus.Failed
                    && task.numAttempts < this.#maxTaskAttempts)) {
                        return task;
                    }
        });
    }
}
