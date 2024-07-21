import { TaskStatus } from '../enums/TaskStatus.js';

export abstract class BaseTask {
    #taskStatus: TaskStatus = TaskStatus.Idle;
    #numAttempts = 0;
    #createdTime: Date;

    constructor() {
        this.#createdTime = new Date();
    }

    get taskStatus(): TaskStatus {
        return this.#taskStatus;
    }

    set taskStatus(taskStatus: TaskStatus) {
        if(taskStatus === TaskStatus.Failed) {
            this.#numAttempts++;
        }

        this.#taskStatus = taskStatus;
    }

    get numAttempts(): number {
        return this.#numAttempts;
    }

    get createdTime() {
        return this.#createdTime;
    }

    process(): Promise<void> {
        // Reject by default, because this method is intended to be overridden.
        return Promise.reject();
    }
}
