import { TaskStatus } from '../enums/TaskStatus.js';
import { TaskType } from '../enums/TaskType.js';

export abstract class BaseTask {
    protected _taskType: TaskType = TaskType.Delayed;
    #taskStatus: TaskStatus = TaskStatus.Idle;
    #numAttempts = 0;
    #createdTime: Date;

    constructor() {
        this.#createdTime = new Date();
    }

    get taskType(): TaskType {
        return this._taskType;
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
        return Promise.reject('The base process() method must be overridden.');
    }

    postProcess(): Promise<void> {
        return Promise.reject('The base postProcess() method must be overridden.');
    }
}
