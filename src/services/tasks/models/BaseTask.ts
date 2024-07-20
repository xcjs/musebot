import { TaskStatus } from '../enums/TaskStatus.js';

export abstract class BaseTask {
    #taskStatus: TaskStatus = TaskStatus.Idle;
    #numAttempts = 0;

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

    process(): Promise<void> {
        // Reject by default, because this method is intended to be overridden.
        return Promise.reject();
    }
}
