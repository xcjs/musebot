import { BaseTask } from './models/BaseTask.js';

export interface ITaskQueue {
    isActive: boolean;
    add(task: BaseTask<unknown>): void;
}
