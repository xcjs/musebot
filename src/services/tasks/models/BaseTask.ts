import { randomUUID, UUID } from 'node:crypto';

import { IBotServiceContainer } from '../../IBotServiceContainer.js';
import { ILogger } from '../../ILogger.js';
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

    #isChild = false;
    get isChild(): boolean {
        return this.#isChild;
    }

    set isChild(isChild: boolean) {
        this.#isChild = isChild;
    }

    set onSuccess(callback: (payload: T) => void) { }

    protected services: IBotServiceContainer;
    parallelizationStrategy: IParallelizationStrategy;
    logger: ILogger;

    readonly #id: UUID;
    #taskStatus: TaskStatus = TaskStatus.Idle;
    #numAttempts: number = 0;
    readonly #maxAttempts: number = 0;
    readonly #createdTime: Date;
    #startedTime: Date | null = null;

    constructor(services: IBotServiceContainer) {
        this.services = services;
        this.parallelizationStrategy = services.parallelizationStrategy;

        this.logger = services.getLogger('BaseTask');

        this.#id = randomUUID();
        this.#createdTime = new Date();
        this.#maxAttempts = services.configurationService.maxTaskAttempts;
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
