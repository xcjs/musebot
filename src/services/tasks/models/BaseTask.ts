import { randomUUID, UUID } from 'node:crypto';

import { IEnvironmentSettings } from '../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../ILogger.js';
import { IServiceContainer } from '../../IServiceContainer.js';
import { TaskStatus } from '../enums/TaskStatus.js';

export abstract class BaseTask<T> {
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

                this.#logger.info(`Delaying task ${this.#id} until ${this.#delayUntil.toLocaleDateString()}.`)
            }
        } else {
            this.#taskStatus = taskStatus;
        }

        this.#logger.info(`Setting taskStatus of task ${this.id} to ${taskStatus}.`);
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

    set onSuccess(callback: (context: T) => void) { }

    #environmentSettings: IEnvironmentSettings;
    #logger: ILogger;

    #id: UUID;
    #taskStatus: TaskStatus = TaskStatus.Idle;
    #numAttempts = 0;
    #maxAttempts = 0;
    #createdTime: Date;
    #startedTime: Date;
    #delayUntil: Date;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;

        this.#logger = services.getLogger('BaseTask');

        this.#id = randomUUID();
        this.#createdTime = new Date();
        this.#maxAttempts = services.environmentSettings.maxTaskAttempts;
    }

    async process(): Promise<void> {
        this.#startedTime = new Date();
        this.#logger.info(`Starting task ${this.#id} at ${this.startedTime.toISOString()}`);
        await Promise.resolve();
    }

    async postProcess(): Promise<void> {
        this.#logger.info(`Post-processing task ${this.#id} at ${new Date().toISOString()}`);
        await Promise.resolve();
    }
}
