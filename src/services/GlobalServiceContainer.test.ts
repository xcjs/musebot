import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TaskQueueStrategy } from '../enums/TaskQueueStrategy.js';
import type { ILlmClient } from './clients/llm/ILlmClient.js';
import { LlmTaskChannelPostProcessor } from './clients/llm/tasks/LlmTaskChannelPostProcessor.js';
import type { ComfyUiClient } from './clients/media/comfy-ui/ComfyUiClient.js';
import { ComfyUiTaskChannelPostProcessor } from './clients/media/comfy-ui/services/ComfyUiTaskChannelPostProcessor.js';
import type { IGlobalConfiguration } from './environment-settings/IGlobalConfiguration.js';
import { SupportedFeature } from './features/enum/SupportedFeature.js';
import type { IFeatureService } from './features/IFeatureService.js';
import { GlobalServiceContainer } from './GlobalServiceContainer.js';
import type { IBotServiceContainer } from './IBotServiceContainer.js';
import type { ILogger } from './ILogger.js';
import { GenerativeAiChannelPostProcessor } from './parallelization/GenerativeAiChannelPostProcessor.js';
import { NoOpTaskChannelPostProcessor } from './parallelization/NoOpTaskChannelPostProcessor.js';

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

function createMockFeatureService(hasTxt2Txt: boolean, hasMedia: boolean): jest.Mocked<IFeatureService> {
  return {
    hasFeature: jest.fn((feature) => {
      if (feature === SupportedFeature.Txt2Txt) return hasTxt2Txt;
      return hasMedia;
    }),
  } as unknown as jest.Mocked<IFeatureService>;
}

function createMockLlmClient(): jest.Mocked<ILlmClient> {
  return {
    host: new URL('http://127.0.0.1:11434'),
    free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  } as unknown as jest.Mocked<ILlmClient>;
}

function createMockComfyUiClient(): jest.Mocked<ComfyUiClient> {
  return {
    host: new URL('http://gpu.internal:7860'),
    free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  } as unknown as jest.Mocked<ComfyUiClient>;
}

function createMockGlobalConfiguration(): IGlobalConfiguration {
  return {
    taskQueue: {
      numAttempts: 3,
      retryDelayMs: 1000,
      strategy: TaskQueueStrategy.Serial,
      forceSerialAcrossHosts: false,
    },
  };
}

function createMockServices(
  logger: jest.Mocked<ILogger>,
  featureService: jest.Mocked<IFeatureService>,
  llmClient: jest.Mocked<ILlmClient>,
  comfyUiClient: jest.Mocked<ComfyUiClient>
): IBotServiceContainer {
  return {
    featureService,
    getLogger: jest.fn(() => logger),
    llmClient,
    comfyUiClient,
  } as unknown as IBotServiceContainer;
}

describe('GlobalServiceContainer', () => {
  let globalServiceContainer: GlobalServiceContainer;

  beforeEach((): void => {
    globalServiceContainer = new GlobalServiceContainer(createMockGlobalConfiguration());
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('getTaskChannelPostProcessor()', () => {
    it('should scope a hostnamed GenerativeAI channel to that hostname', async (): Promise<void> => {
      const mockLogger = createMockLogger();
      const mockLlmClient = createMockLlmClient();
      const mockComfyUiClient = createMockComfyUiClient();
      const processor = globalServiceContainer.getTaskChannelPostProcessor(
        createMockServices(mockLogger, createMockFeatureService(true, true), mockLlmClient, mockComfyUiClient),
        'GenerativeAI_127.0.0.1'
      );

      expect(processor).toBeInstanceOf(GenerativeAiChannelPostProcessor);
      await processor.postProcess();

      expect(mockLlmClient.free).toHaveBeenCalledTimes(1);
      expect(mockComfyUiClient.free).not.toHaveBeenCalled();
    });

    it('should scope a hostnamed child GenerativeAI channel to that hostname', async (): Promise<void> => {
      const mockLogger = createMockLogger();
      const mockLlmClient = createMockLlmClient();
      const mockComfyUiClient = createMockComfyUiClient();
      const processor = globalServiceContainer.getTaskChannelPostProcessor(
        createMockServices(mockLogger, createMockFeatureService(true, true), mockLlmClient, mockComfyUiClient),
        'GenerativeAI_Child_127.0.0.1'
      );

      expect(processor).toBeInstanceOf(GenerativeAiChannelPostProcessor);
      await processor.postProcess();

      expect(mockLlmClient.free).toHaveBeenCalledTimes(1);
      expect(mockComfyUiClient.free).not.toHaveBeenCalled();
    });

    it('should free both subsystems on the bare global GenerativeAI channel', async (): Promise<void> => {
      const mockLogger = createMockLogger();
      const mockLlmClient = createMockLlmClient();
      const mockComfyUiClient = createMockComfyUiClient();
      const processor = globalServiceContainer.getTaskChannelPostProcessor(
        createMockServices(mockLogger, createMockFeatureService(true, true), mockLlmClient, mockComfyUiClient),
        'GenerativeAI'
      );

      expect(processor).toBeInstanceOf(GenerativeAiChannelPostProcessor);
      await processor.postProcess();

      expect(mockLlmClient.free).toHaveBeenCalledTimes(1);
      expect(mockComfyUiClient.free).toHaveBeenCalledTimes(1);
    });

    it('should free both subsystems when a child GenerativeAI channel has no hostname', async (): Promise<void> => {
      const mockLogger = createMockLogger();
      const mockLlmClient = createMockLlmClient();
      const mockComfyUiClient = createMockComfyUiClient();
      const processor = globalServiceContainer.getTaskChannelPostProcessor(
        createMockServices(mockLogger, createMockFeatureService(true, true), mockLlmClient, mockComfyUiClient),
        'GenerativeAI_Child'
      );

      expect(processor).toBeInstanceOf(GenerativeAiChannelPostProcessor);
      await processor.postProcess();

      expect(mockLlmClient.free).toHaveBeenCalledTimes(1);
      expect(mockComfyUiClient.free).toHaveBeenCalledTimes(1);
    });

    it('should return the LLM post-processor for LargeLanguageModel channels', (): void => {
      const processor = globalServiceContainer.getTaskChannelPostProcessor(
        createMockServices(createMockLogger(), createMockFeatureService(true, true), createMockLlmClient(), createMockComfyUiClient()),
        'LargeLanguageModel_127.0.0.1'
      );

      expect(processor).toBeInstanceOf(LlmTaskChannelPostProcessor);
    });

    it('should return the ComfyUI post-processor for Media channels', (): void => {
      const processor = globalServiceContainer.getTaskChannelPostProcessor(
        createMockServices(createMockLogger(), createMockFeatureService(true, true), createMockLlmClient(), createMockComfyUiClient()),
        'Media_gpu.internal'
      );

      expect(processor).toBeInstanceOf(ComfyUiTaskChannelPostProcessor);
    });

    it('should return the NoOp post-processor for unmapped channels', (): void => {
      const processor = globalServiceContainer.getTaskChannelPostProcessor(
        createMockServices(createMockLogger(), createMockFeatureService(true, true), createMockLlmClient(), createMockComfyUiClient()),
        'Chat'
      );

      expect(processor).toBeInstanceOf(NoOpTaskChannelPostProcessor);
    });
  });
});
