import { randomUUID, UUID } from 'node:crypto';

import { ILogger } from '../../ILogger.js';
import { IServiceContainer } from '../../IServiceContainer.js';
import { IParallelizationStrategy } from '../../parallelization/IParallelizationStrategy.js';
import { ResourceType } from '../../parallelization/ResourceType.js';
import { TaskStatus } from '../enums/TaskStatus.js';

export abstract class BaseTask<T> {
    get id(): UUID {
        return this.#id;
    }

    get taskStatus(): TaskStatus {
        return this.#taskStatus;
    }

    set taskStatus(taskStatus: TaskStatus) {
        if (taskStatus === TaskStatus.Failed) {
            if (this.taskStatus !== TaskStatus.Failed) {
                this.#numAttempts++;

                if (this.#numAttempts >= this.#maxAttempts) {
                    this.#taskStatus = TaskStatus.Dead;
                }
            }
        } else {
            this.#taskStatus = taskStatus;
        }

        this.logger.info(`Setting taskStatus of task ${this.id} to ${taskStatus}.`);
    }

    abstract get taskChannel(): string;

    get numAttempts(): number {
        return this.#numAttempts;
    }

    get createdTime(): Date {
        return this.#createdTime;
    }

    get startedTime(): Date | null {
        return this.#startedTime;
    }

    get resourceType(): ResourceType {
        return ResourceType.None;
    }

    set onSuccess(callback: (payload: T) => void) { }

    parallelizationStrategy: IParallelizationStrategy;
    logger: ILogger;

    #id: UUID;
    #taskStatus: TaskStatus = TaskStatus.Idle;
    #numAttempts = 0;
    #maxAttempts = 0;
    #createdTime: Date;
    #startedTime: Date | null = null;

    constructor(services: IServiceContainer) {
        this.parallelizationStrategy = services.parallelizationStrategy;

        this.logger = services.getLogger('BaseTask');

        this.#id = randomUUID();
        this.#createdTime = new Date();
        this.#maxAttempts = services.environmentSettings.maxTaskAttempts;
    }

    async preProcess(): Promise<void> {
        this.logger.info(`Pre-processing task ${this.#id}.`);
        await Promise.resolve();
    }

    async process(): Promise<void> {
        this.#startedTime = new Date();
        this.logger.info(`Processing task ${this.#id}.`);
        await Promise.resolve();
    }

    async postProcess(): Promise<void> {
        this.logger.info(`Post-processing task ${this.#id}.`);
        await Promise.resolve();
    }
}
