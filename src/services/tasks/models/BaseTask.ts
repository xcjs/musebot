import { TaskStatus } from '../enums/TaskStatus';

export abstract class BaseTask {
    protected _taskStatus: TaskStatus = TaskStatus.Idle;
    protected _numAttempts = 0;

    get taskStatus(): TaskStatus {
        return this._taskStatus;
    }

    get numAttempts(): number {
        return this._numAttempts;
    }

    constructor() {

    }

    incrementAttempts(): void {
        this._numAttempts++;
    }
}
