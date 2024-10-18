import { IServiceContainer } from '../../IServiceContainer.js';
import { TaskStatus } from '../enums/TaskStatus.js';

export abstract class BaseTask {
    #taskStatus: TaskStatus = TaskStatus.Idle;
    #numAttempts = 0;
    #maxAttempts = 0;
    #createdTime: Date;

    constructor(services: IServiceContainer) {
        this.#maxAttempts = services.environmentSettings.maxTaskAttempts;
        this.#createdTime = new Date();
    }

    get taskStatus(): TaskStatus {
        return this.#taskStatus;
    }

    set taskStatus(taskStatus: TaskStatus) {
        if(taskStatus === TaskStatus.Failed) {
            this.#numAttempts++;
        }

        if(this.#numAttempts >= this.#maxAttempts) {
            this.#taskStatus = TaskStatus.Dead;
        } else {
            this.#taskStatus = taskStatus;
        }
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

    set onSuccess(callback: (context: Array<number>) => void) { }

    process(): Promise<void> {
        return Promise.reject('The base process() method must be overridden.');
    }

    postProcess(): Promise<void> {
        return Promise.reject('The base postProcess() method must be overridden.');
    }
}
