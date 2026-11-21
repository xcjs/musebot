import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TaskQueueStrategy } from '../../../../../enums/TaskQueueStrategy.js';
import type { IConfigurationService } from '../../../../environment-settings/IConfigurationService.js';
import type { IFeatureService } from '../../../../features/IFeatureService.js';
import type { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import type { ILogger } from '../../../../ILogger.js';
import type { IParallelizationStrategy } from '../../../../parallelization/IParallelizationStrategy.js';
import type { ITaskChannelPostProcessor } from '../../../../parallelization/ITaskChannelPostProcessor.js';
import type { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import type { ComfyUiClient } from '../ComfyUiClient.js';
import type { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

function createMockLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };
}

function createMockFeatureService(hasTxt2Txt: boolean): jest.Mocked<IFeatureService> {
  return {
    hasFeature: jest.fn(() => hasTxt2Txt),
  } as unknown as jest.Mocked<IFeatureService>;
}

function createMockComfyUiClient(freeResult: boolean): jest.Mocked<ComfyUiClient> {
  return {
    host: new URL('http://localhost:8188'),
    free: jest.fn<() => Promise<boolean>>().mockResolvedValue(freeResult),
    render: jest.fn(),
    disconnect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ComfyUiClient>;
}

function createMockLlmClient(): { host: URL; free: jest.MockedFunction<() => Promise<boolean>>; waitForModelUnload: jest.MockedFunction<() => Promise<boolean>> } {
  return {
    host: new URL('http://127.0.0.1:11434'),
    free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    waitForModelUnload: jest.fn<() => Promise<boolean>>().mockResolvedValue(true)
  };
}

function createMockTaskQueue(isChannelActive: (channelName: string) => boolean = (): boolean => false): ITaskQueue {
  return {
    isActive: false,
    isChannelActive: jest.fn(isChannelActive),
    add: jest.fn(),
  } as unknown as ITaskQueue;
}

function createMockWorkflowService(): jest.Mocked<IWorkflowService> {
  return {
    loadWorkflows: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<IWorkflowService>;
}

class TestableComfyUiTask extends ComfyUiBaseTask {
  override async process(): Promise<void> {
    await super.process();
  }
}

function createMockServices(
  config: IConfigurationService,
  logger: jest.Mocked<ILogger>,
  featureService: jest.Mocked<IFeatureService>,
  comfyUiClient: jest.Mocked<ComfyUiClient>,
  llmClient: { host: URL; free: jest.MockedFunction<() => Promise<boolean>>; waitForModelUnload: jest.MockedFunction<() => Promise<boolean>> },
  workflowService: jest.Mocked<IWorkflowService>,
  taskQueue: ITaskQueue,
  getTaskChannel?: (resourceType: unknown, isChild: boolean, resourceUrl: URL | null) => string
): IBotServiceContainer {
  return {
    configurationService: config,
    featureService,
    taskQueue,
    typingService: null as never,
    discordClient: null as never,
    generativeChatClient: null as never,
    helpService: null as never,
    workflowService,
    webContentService: null as never,
    llmHostFlavorRegistry: null as never,
    parallelizationStrategy: {
      getTaskChannel: jest.fn(getTaskChannel ?? ((
        _resourceType: unknown,
        isChild: boolean,
        resourceUrl: URL | null
      ): string => resourceUrl === null ? 'test' : (isChild ? `child_${resourceUrl.host}` : resourceUrl.host))),
    } as unknown as IParallelizationStrategy,
    getLogger: jest.fn(() => logger),
    getTaskChannelPostProcessor: (() => null as never) as unknown as () => ITaskChannelPostProcessor,
    getContextMessageFactory: () => null as never,
    getContextService: () => null as never,
    getContextCompressionService: () => null as never,
    getLlmGenerateTask: () => null as never,
    getLlmGenerateStructuredTask: () => null as never,
    getEmojiReactionTask: () => null as never,
    getEmbedTask: () => null as never,
    getMessageTask: () => null as never,
    getInteractionTask: () => null as never,
    getAttachmentTask: () => null as never,
    getCustomInteractionTask: () => null as never,
    getWorkflowMutator: () => null as never,
    getReplyService: () => null as never,
    contentTypeService: null as never,
    comfyUiClient,
    comfyUiReplyService: null as never,
    llmClient: llmClient as never,
    llmReplyService: null as never,
    llmStreamingReplyService: null as never,
    actionRowBuilderFactory: null as never,
    getChatMessageFilters: () => [], getInputChatMessageFilters: () => [],
    getChatMessageFactory: () => null as never, getLlmChatMessageFactory: () => null as never, getMemoryService: () => null as never,
  };
}

function createMockConfig(overrides: Partial<IConfigurationService> = {}): IConfigurationService {
  return {
    taskQueueStrategy: TaskQueueStrategy.Serial,
    maxTaskAttempts: 3,
    ...overrides,
  } as unknown as IConfigurationService;
}

describe('ComfyUiBaseTask', () => {
  let mockLogger: jest.Mocked<ILogger>;
  let mockConfig: IConfigurationService;
  let mockFeatureService: jest.Mocked<IFeatureService>;
  let mockComfyUiClient: jest.Mocked<ComfyUiClient>;
  let mockLlmClient: { host: URL; free: jest.MockedFunction<() => Promise<boolean>>; waitForModelUnload: jest.MockedFunction<() => Promise<boolean>> };
  let mockWorkflowService: jest.Mocked<IWorkflowService>;
  let mockTaskQueue: ITaskQueue;
  let task: TestableComfyUiTask;

  beforeEach((): void => {
    mockLogger = createMockLogger();
    mockConfig = createMockConfig();
    mockFeatureService = createMockFeatureService(true);
    mockComfyUiClient = createMockComfyUiClient(true);
    mockLlmClient = createMockLlmClient();
    mockWorkflowService = createMockWorkflowService();
    mockTaskQueue = createMockTaskQueue();

    task = new TestableComfyUiTask(createMockServices(
      mockConfig, mockLogger, mockFeatureService, mockComfyUiClient, mockLlmClient, mockWorkflowService, mockTaskQueue
    ));
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('preProcess()', () => {
    it('should not unload the LLM model when the LLM channel is idle', async (): Promise<void> => {
      await task.preProcess();

      expect(mockLlmClient.waitForModelUnload).not.toHaveBeenCalled();
      expect(mockLlmClient.free).not.toHaveBeenCalled();
      expect(mockTaskQueue.isChannelActive).toHaveBeenCalledWith('127.0.0.1:11434');
      expect(mockTaskQueue.isChannelActive).toHaveBeenCalledWith('child_127.0.0.1:11434');
    });

    it('should wait for a streaming LLM response to finish instead of unloading the model', async (): Promise<void> => {
      let busyChecks = 0;
      mockTaskQueue = createMockTaskQueue((channelName: string): boolean => channelName === '127.0.0.1:11434' && ++busyChecks <= 1);
      task = new TestableComfyUiTask(createMockServices(
        mockConfig, mockLogger, mockFeatureService, mockComfyUiClient, mockLlmClient, mockWorkflowService, mockTaskQueue
      ));

      await task.preProcess();

      expect(mockLlmClient.waitForModelUnload).not.toHaveBeenCalled();
      expect(mockLlmClient.free).not.toHaveBeenCalled();
    });

    it('should not wait when the LLM channel is the same as this task channel (forceSerialAcrossHosts)', async (): Promise<void> => {
      mockTaskQueue = createMockTaskQueue((): boolean => true);
      task = new TestableComfyUiTask(createMockServices(
        mockConfig, mockLogger, mockFeatureService, mockComfyUiClient, mockLlmClient, mockWorkflowService, mockTaskQueue,
        (): string => 'test'
      ));

      await task.preProcess();

      expect(mockLlmClient.waitForModelUnload).not.toHaveBeenCalled();
      expect(mockTaskQueue.isChannelActive).not.toHaveBeenCalled();
    });

    it('should not check the LLM channel when not in serial mode', async (): Promise<void> => {
      const parallelConfig = createMockConfig({ taskQueueStrategy: TaskQueueStrategy.Parallel });
      task = new TestableComfyUiTask(createMockServices(
        parallelConfig, mockLogger, mockFeatureService, mockComfyUiClient, mockLlmClient, mockWorkflowService, mockTaskQueue
      ));

      await task.preProcess();

      expect(mockLlmClient.waitForModelUnload).not.toHaveBeenCalled();
      expect(mockTaskQueue.isChannelActive).not.toHaveBeenCalled();
    });

    it('should not check the LLM channel when Txt2Txt feature is unavailable', async (): Promise<void> => {
      const noTxt2Txt = createMockFeatureService(false);
      task = new TestableComfyUiTask(createMockServices(
        mockConfig, mockLogger, noTxt2Txt, mockComfyUiClient, mockLlmClient, mockWorkflowService, mockTaskQueue
      ));

      await task.preProcess();

      expect(mockLlmClient.waitForModelUnload).not.toHaveBeenCalled();
      expect(mockTaskQueue.isChannelActive).not.toHaveBeenCalled();
    });
  });

  describe('process()', () => {
    it('should load workflows', async (): Promise<void> => {
      await task.process();

      expect(mockWorkflowService.loadWorkflows).toHaveBeenCalledTimes(1);
    });
  });
});
