import { ITask } from '../interfaces/ITask';


export class Job<T extends ITask> {
    #task: T;

    constructor(task: T) {
        this.#task = task;
    }
}
