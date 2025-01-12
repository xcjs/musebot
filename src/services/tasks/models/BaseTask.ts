import { randomUUID, UUID } from 'node:crypto';

import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../IServiceContainer.js';
import { TaskStatus } from '../enums/TaskStatus.js';

export abstract class BaseTask {
    get id(): UUID {
        return this.#id;
    }

    get taskStatus(): TaskStatus {
        if (this.#taskStatus === TaskStatus.Delayed
            && Date.now() >= this.#delayUntil.getTime()) {
            this.#taskStatus = TaskStatus.Failed;
        }

        return this.#taskStatus;
    }

    set taskStatus(taskStatus: TaskStatus) {
        if(taskStatus === TaskStatus.Delayed) {
            taskStatus = TaskStatus.Failed;
        }

        if (taskStatus === TaskStatus.Failed) {
            this.#numAttempts++;

            if (this.#numAttempts >= this.#maxAttempts) {
                this.#taskStatus = TaskStatus.Dead;
            } else {
                this.#taskStatus = TaskStatus.Delayed;
                this.#delayUntil = new Date(Date.now() + this.#environmentSettings.taskRetryDelayMilliseconds);

                this.#logger(LogLevel.Info, `Delaying task ${this.#id} until ${this.#delayUntil}.`)
            }
        } else {
            this.#taskStatus = taskStatus;
        }

        this.#logger(LogLevel.Info, `Setting taskStatus of task ${this.id} to ${taskStatus}.`);
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

    get startedTime(): Date {
        return this.#startedTime;
    }

    set onSuccess(callback: (context: Array<number>) => void) { }

    #environmentSettings: IEnvironmentSettings;
    #logger;

    #id: UUID;
    #taskStatus: TaskStatus = TaskStatus.Idle;
    #numAttempts = 0;
    #maxAttempts = 0;
    #createdTime: Date;
    #startedTime: Date;
    #delayUntil: Date;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'BaseTask');

        this.#id = randomUUID();
        this.#createdTime = new Date();
        this.#maxAttempts = services.environmentSettings.maxTaskAttempts;
    }

    async process(): Promise<void> {
        this.#startedTime = new Date();

        this.#logger(LogLevel.Info, `Starting task ${this.#id} at ${this.startedTime}`);
    }

    async postProcess(): Promise<void> {

    }
}
