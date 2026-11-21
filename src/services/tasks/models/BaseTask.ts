import { randomUUID, UUID } from 'node:crypto';

import { IBotServiceContainer } from '../../IBotServiceContainer.js';
import { ILogger } from '../../ILogger.js';
import { IParallelizationStrategy } from '../../parallelization/IParallelizationStrategy.js';
import { ResourceType } from '../../parallelization/ResourceType.js';
import { TaskStatus } from '../enums/TaskStatus.js';
import { ITaskQueue } from '../ITaskQueue.js';

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

  #onSuccess: ((payload: T) => void) | null = null;
  set onSuccess(callback: (payload: T) => void) {
    this.#onSuccess = callback;
  }

  #onFailure: ((error: Error) => void) | null = null;
  set onFailure(callback: (error: Error) => void) {
    this.#onFailure = callback;
  }

  protected invokeOnSuccess(payload: T): void {
    this.#onSuccess?.(payload);
  }

  protected invokeOnFailure(error: Error): void {
    this.#onFailure?.(error);
  }

  protected companionChannelNames(resourceType: ResourceType, resourceUrl: URL): string[] {
    return [
      this.parallelizationStrategy.getTaskChannel(resourceType, false, resourceUrl),
      this.parallelizationStrategy.getTaskChannel(resourceType, true, resourceUrl)
    ];
  }

  protected isCompanionChannelBusy(resourceType: ResourceType, resourceUrl: URL): boolean {
    const ownChannel = this.taskChannel;

    return this.companionChannelNames(resourceType, resourceUrl)
      .some(name => name !== ownChannel && this.#taskQueue.isChannelActive(name));
  }

  protected async waitForCompanionChannelDrain(resourceType: ResourceType, resourceUrl: URL, intervalMs: number = 1000): Promise<void> {
    while (this.isCompanionChannelBusy(resourceType, resourceUrl)) {
      this.logger.info(`A ${resourceType} response is currently in progress; waiting for it to finish.`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  get lastError(): Error | null {
    return this.#lastError;
  }

  set lastError(error: Error) {
    this.#lastError = error;
  }

  readonly services: IBotServiceContainer;
  parallelizationStrategy: IParallelizationStrategy;
  logger: ILogger;

  readonly #id: UUID;
  #taskStatus: TaskStatus = TaskStatus.Idle;
  #numAttempts: number = 0;
  readonly #maxAttempts: number = 0;
  readonly #createdTime: Date;
  #startedTime: Date | null = null;
  #lastError: Error | null = null;
  readonly #taskQueue: ITaskQueue;

  constructor(services: IBotServiceContainer) {
    this.services = services;
    this.parallelizationStrategy = services.parallelizationStrategy;

    this.logger = services.getLogger('BaseTask');

    this.#id = randomUUID();
    this.#createdTime = new Date();
    this.#maxAttempts = services.configurationService.maxTaskAttempts;
    this.#taskQueue = services.taskQueue;
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
