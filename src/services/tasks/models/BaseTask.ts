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

    get taskChannel(): string {
        throw new Error('The base getTaskChannel() method must be overridden.');
    }

    get numAttempts(): number {
        return this.#numAttempts;
    }

    get createdTime(): Date {
        return this.#createdTime;
    }

    process(): Promise<void> {
        return Promise.reject('The base process() method must be overridden.');
    }

    postProcess(): Promise<void> {
        return Promise.reject('The base postProcess() method must be overridden.');
    }
}
