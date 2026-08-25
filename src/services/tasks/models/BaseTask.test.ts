import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { IConfigurationService } from '../../environment-settings/IConfigurationService.js';
import type { IBotServiceContainer } from '../../IBotServiceContainer.js';
import type { ILogger } from '../../ILogger.js';
import type { IParallelizationStrategy } from '../../parallelization/IParallelizationStrategy.js';
import { TaskStatus } from '../enums/TaskStatus.js';
import { BaseTask } from './BaseTask.js';

function createMockLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn()
  };
}

function createMockServices(): IBotServiceContainer {
  const logger = createMockLogger();
  return {
    configurationService: { maxTaskAttempts: 3 } as unknown as IConfigurationService,
    parallelizationStrategy: { getTaskChannel: jest.fn(() => 'test') } as unknown as IParallelizationStrategy,
    getLogger: jest.fn(() => logger)
  } as unknown as IBotServiceContainer;
}

class TestTask extends BaseTask<string> {
  override get taskChannel(): string {
    return 'test-channel';
  }

  override async process(): Promise<void> {
    await Promise.resolve();
    this.#result = 'done';
  }

  #result: string | null = null;

  override async postProcess(): Promise<void> {
    await super.postProcess();
    if (this.taskStatus === TaskStatus.Successful && this.#result !== null) {
      this.invokeOnSuccess(this.#result);
    }
    if (this.taskStatus === TaskStatus.Dead) {
      this.invokeOnFailure(this.lastError ?? new Error('died'));
    }
  }
}

describe('BaseTask callback registry', () => {
  let task: TestTask;

  beforeEach((): void => {
    task = new TestTask(createMockServices());
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  it('invokes onSuccess callback set via the public setter without subclass override', async (): Promise<void> => {
    const onSuccess = jest.fn<(payload: string) => void>();
    task.onSuccess = onSuccess;

    await task.process();
    task.taskStatus = TaskStatus.Successful;
    await task.postProcess();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('done');
  });

  it('invokes onFailure callback set via the public setter without subclass override', async (): Promise<void> => {
    const onFailure = jest.fn<(error: Error) => void>();
    task.onFailure = onFailure;

    task.lastError = new Error('boom');
    task.taskStatus = TaskStatus.Failed;
    task.taskStatus = TaskStatus.Failed;
    task.taskStatus = TaskStatus.Failed;
    await task.postProcess();

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0].message).toBe('boom');
  });

  it('does not throw when no callback is set and task succeeds', async (): Promise<void> => {
    await task.process();
    task.taskStatus = TaskStatus.Successful;
    await expect(task.postProcess()).resolves.not.toThrow();
  });
});
