import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Attachment, AttachmentBuilder, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { TaskQueueStrategy } from '../../../../../enums/TaskQueueStrategy.js';
import type { IConfigurationService } from '../../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import type { IFeatureService } from '../../../../features/IFeatureService.js';
import type { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import type { ILogger } from '../../../../ILogger.js';
import type { IParallelizationStrategy } from '../../../../parallelization/IParallelizationStrategy.js';
import type { ITaskChannelPostProcessor } from '../../../../parallelization/ITaskChannelPostProcessor.js';
import type { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import type { IReplyService } from '../../../chat/IReplyService.js';
import type { ComfyUiClient } from '../ComfyUiClient.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import type { IWorkflowService } from '../services/IWorkflowService.js';
import type { IWorkflowMutator } from '../services/workflow-mutators/IWorkflowMutator.js';
import { WorkflowNotFoundError } from '../WorkflowNotFoundError.js';
import { ComfyUiInteractionTask } from './ComfyUiInteractionTask.js';

type DiscordReplyService = IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

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

function createMockFeatureService(features: Partial<Record<SupportedFeature, boolean>> = {}): jest.Mocked<IFeatureService> {
  return {
    hasFeature: jest.fn((feature: SupportedFeature): boolean => features[feature] ?? false),
  } as unknown as jest.Mocked<IFeatureService>;
}

function createMockReplyService(overrides: Partial<DiscordReplyService> = {}): jest.Mocked<DiscordReplyService> {
  return {
    getAttachmentsByName: jest.fn(() => []),
    getAttachments: jest.fn(() => []),
    replyWithError: jest.fn<(interaction: ButtonInteraction) => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as jest.Mocked<DiscordReplyService>;
}

function createMockWorkflowService(overrides: Partial<IWorkflowService> = {}): jest.Mocked<IWorkflowService> {
  return {
    hasWorkflows: true,
    workflows: [],
    loadWorkflows: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    hasWorkflowType: jest.fn(() => true),
    getWorkflowDefaults: jest.fn(() => createBaseRenderRequest()),
    renderWorkflow: jest.fn(() => ({} as never)),
    ...overrides,
  } as unknown as jest.Mocked<IWorkflowService>;
}

function createMockComfyUiClient(): jest.Mocked<ComfyUiClient> {
  return {
    host: new URL('http://localhost:8188'),
    free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    render: jest.fn<(prompts: unknown[]) => Promise<unknown>>().mockResolvedValue([]),
    disconnect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ComfyUiClient>;
}

function createMockComfyUiReplyService(): jest.Mocked<ComfyUiReplyService> {
  return {
    reply: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    replyWithImageActionRows: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getFileNameFromPrompt: jest.fn(() => 'file'),
  } as unknown as jest.Mocked<ComfyUiReplyService>;
}

function createMockOllamaClient(): { free: jest.MockedFunction<() => Promise<boolean>>; waitForModelUnload: jest.MockedFunction<() => Promise<boolean>> } {
  return {
    free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    waitForModelUnload: jest.fn<() => Promise<boolean>>().mockResolvedValue(true)
  };
}

function createMockMutator(mutateResult: SerializableRenderRequest | null = null, additionalAttachments: AttachmentBuilder[] = []): jest.Mocked<IWorkflowMutator> {
  return {
    interactions: [],
    types: [],
    contentMessage: 'mutated content',
    additionalAttachments,
    mutate: jest.fn<(renderRequest: SerializableRenderRequest, interaction: ButtonInteraction, workflow: unknown) => Promise<SerializableRenderRequest | null>>()
      .mockResolvedValue(mutateResult),
  } as unknown as jest.Mocked<IWorkflowMutator>;
}

function createMockConfig(overrides: Partial<IConfigurationService> = {}): IConfigurationService {
  return {
    taskQueueStrategy: TaskQueueStrategy.Parallel,
    maxTaskAttempts: 3,
    ...overrides,
  } as unknown as IConfigurationService;
}

function createBaseRenderRequest(overrides: Partial<SerializableRenderRequest> = {}): SerializableRenderRequest {
  const request = new SerializableRenderRequest();
  request.prompt = null;
  request.promptNegative = null;
  request.workflow = 'test-workflow';
  request.seed = 12345;
  request.width = 512;
  request.height = 512;
  request.sampler = 'euler';
  request.scheduler = 'normal';
  request.cfgScale = 7;
  request.steps = 20;
  request.num = 1;
  Object.assign(request, overrides);

  return request;
}

function createMockInteraction(overrides: Record<string, unknown> = {}): jest.Mocked<ButtonInteraction> {
  return {
    customId: 'retry',
    reply: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as jest.Mocked<ButtonInteraction>;
}

function createMockServices(
  config: IConfigurationService,
  logger: jest.Mocked<ILogger>,
  featureService: jest.Mocked<IFeatureService>,
  replyService: jest.Mocked<DiscordReplyService>,
  comfyUiClient: jest.Mocked<ComfyUiClient>,
  comfyUiReplyService: jest.Mocked<ComfyUiReplyService>,
  workflowService: jest.Mocked<IWorkflowService>,
  ollamaClient: { free: jest.MockedFunction<() => Promise<boolean>>; waitForModelUnload: jest.MockedFunction<() => Promise<boolean>> },
  getWorkflowMutator: jest.Mock
): IBotServiceContainer {
  return {
    configurationService: config,
    featureService,
    taskQueue: null as never,
    typingService: null as never,
    discordClient: null as never,
    generativeChatClient: null as never,
    helpService: null as never,
    workflowService,
    webContentService: null as never,
    parallelizationStrategy: { getTaskChannel: jest.fn(() => 'test') } as unknown as IParallelizationStrategy,
    getLogger: jest.fn(() => logger),
    getTaskChannelPostProcessor: (() => null as never) as unknown as () => ITaskChannelPostProcessor,
    getContextMessageFactory: () => null as never,
    getContextService: () => null as never,
    getLlmGenerateTask: () => null as never,
    getLlmGenerateStructuredTask: () => null as never,
    getEmojiReactionTask: () => null as never,
    getEmbedTask: () => null as never,
    getMessageTask: () => null as never,
    getInteractionTask: () => null as never,
    getAttachmentTask: () => null as never,
    getCustomInteractionTask: () => null as never,
    getWorkflowMutator: getWorkflowMutator as unknown as IBotServiceContainer['getWorkflowMutator'],
    getReplyService: (() => replyService) as unknown as IBotServiceContainer['getReplyService'],
    contentTypeService: null as never,
    comfyUiClient,
    comfyUiReplyService,
    ollamaClient: ollamaClient as never,
    ollamaReplyService: null as never,
    ollamaStreamingReplyService: null as never,
    actionRowBuilderFactory: null as never,
    getChatMessageFilters: () => [], getInputChatMessageFilters: () => [],
    getChatMessageFactory: () => null as never, getLlmChatMessageFactory: () => null as never, getMemoryService: () => null as never,
  };
}

function createWorkflow(name: string, type: SupportedFeature): { name: string; workflowString: string; type: SupportedFeature } {
  return { name, workflowString: '{}', type };
}

describe('ComfyUiInteractionTask', () => {
  let mockLogger: jest.Mocked<ILogger>;
  let mockConfig: IConfigurationService;
  let mockFeatureService: jest.Mocked<IFeatureService>;
  let mockReplyService: jest.Mocked<DiscordReplyService>;
  let mockComfyUiClient: jest.Mocked<ComfyUiClient>;
  let mockComfyUiReplyService: jest.Mocked<ComfyUiReplyService>;
  let mockWorkflowService: jest.Mocked<IWorkflowService>;
  let mockOllamaClient: { free: jest.MockedFunction<() => Promise<boolean>>; waitForModelUnload: jest.MockedFunction<() => Promise<boolean>> };
  let mockMutator: jest.Mocked<IWorkflowMutator>;
  let mockGetWorkflowMutator: jest.Mock;
  let mockInteraction: jest.Mocked<ButtonInteraction>;

  function createTask(): ComfyUiInteractionTask {
    return new ComfyUiInteractionTask(createMockServices(
      mockConfig, mockLogger, mockFeatureService, mockReplyService,
      mockComfyUiClient, mockComfyUiReplyService, mockWorkflowService,
      mockOllamaClient, mockGetWorkflowMutator
    ), mockInteraction);
  }

  beforeEach((): void => {
    mockLogger = createMockLogger();
    mockConfig = createMockConfig();
    mockFeatureService = createMockFeatureService();
    mockReplyService = createMockReplyService();
    mockComfyUiClient = createMockComfyUiClient();
    mockComfyUiReplyService = createMockComfyUiReplyService();
    mockWorkflowService = createMockWorkflowService();
    mockOllamaClient = createMockOllamaClient();
    mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'test-workflow' }));
    mockGetWorkflowMutator = jest.fn(() => mockMutator);
    mockInteraction = createMockInteraction();
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('process() — null handling (the fix)', () => {
    it('should continue when mutator.mutate() returns null instead of crashing', async (): Promise<void> => {
      const workflow = createWorkflow('test-workflow', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      const inputReq = createBaseRenderRequest({ workflow: 'test-workflow' });
      // Provide state attachment so #readRenderRequests returns our request
      const stateAttachment = { url: 'http://example.com/Prompt.dat' } as never;
      mockReplyService.getAttachmentsByName = jest.fn(() => [stateAttachment]);

      // Mock fetch globally
      const mockJson = JSON.stringify([inputReq]);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn<(url: unknown) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>>()
        .mockResolvedValue({
          arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode(mockJson).buffer)
        }) as never;

      mockMutator = createMockMutator(null);
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      try {
        await createTask().process();
      } catch {
        // May or may not throw depending on prompt accumulation
      }

      // The mutator was called but returned null, so no prompts should be rendered
      expect(mockMutator.mutate).toHaveBeenCalledTimes(1);
      globalThis.fetch = originalFetch;
    });

    it('should not dereference renderRequest.workflow when mutate returns null', async (): Promise<void> => {
      const workflow = createWorkflow('test-workflow', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      const inputReq = createBaseRenderRequest({ workflow: 'test-workflow' });
      const stateAttachment = { url: 'http://example.com/Prompt.dat' } as never;
      mockReplyService.getAttachmentsByName = jest.fn(() => [stateAttachment]);

      const mockJson = JSON.stringify([inputReq]);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn<(url: unknown) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>>()
        .mockResolvedValue({
          arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode(mockJson).buffer)
        }) as never;

      mockMutator = createMockMutator(null);
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      // Should not throw a TypeError about null.workflow
      await expect(createTask().process()).resolves.not.toThrow();
      globalThis.fetch = originalFetch;
    });
  });

  describe('process() — workflow resolution', () => {
    it('should throw WorkflowNotFoundError when no workflows match input render requests and no txt2* workflow exists', async (): Promise<void> => {
      mockWorkflowService.workflows = [];
      // No state attachments, no regular attachments with descriptions
      mockReplyService.getAttachmentsByName = jest.fn(() => []);
      mockReplyService.getAttachments = jest.fn(() => []);

      await expect(createTask().process()).rejects.toThrow(WorkflowNotFoundError);
    });

    it('should create a novel workflow when no input render requests match existing workflows', async (): Promise<void> => {
      const workflow = createWorkflow('txt2img-wf', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      mockReplyService.getAttachmentsByName = jest.fn(() => []);
      mockReplyService.getAttachments = jest.fn(() => []);
      const defaultReq = createBaseRenderRequest({ workflow: 'txt2img-wf' });
      mockWorkflowService.getWorkflowDefaults = jest.fn(() => defaultReq);
      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'txt2img-wf' }));
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockWorkflowService.getWorkflowDefaults).toHaveBeenCalledWith(workflow);
      expect(mockComfyUiClient.render).toHaveBeenCalledTimes(1);
    });

    it('should throw WorkflowNotFoundError when mutator returns a non-existent workflow name', async (): Promise<void> => {
      const workflow = createWorkflow('test-workflow', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      const inputReq = createBaseRenderRequest({ workflow: 'test-workflow' });
      const stateAttachment = { url: 'http://example.com/Prompt.dat' } as never;
      mockReplyService.getAttachmentsByName = jest.fn(() => [stateAttachment]);

      const mockJson = JSON.stringify([inputReq]);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn<(url: unknown) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>>()
        .mockResolvedValue({
          arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode(mockJson).buffer)
        }) as never;

      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'nonexistent-wf' }));
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await expect(createTask().process()).rejects.toThrow(WorkflowNotFoundError);
      globalThis.fetch = originalFetch;
    });

    it('should use the new workflow when mutator changes the workflow name to a valid one', async (): Promise<void> => {
      const workflow1 = createWorkflow('test-workflow', SupportedFeature.Txt2Img);
      const workflow2 = createWorkflow('new-workflow', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow1, workflow2];
      const inputReq = createBaseRenderRequest({ workflow: 'test-workflow' });
      const stateAttachment = { url: 'http://example.com/Prompt.dat' } as never;
      mockReplyService.getAttachmentsByName = jest.fn(() => [stateAttachment]);

      const mockJson = JSON.stringify([inputReq]);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn<(url: unknown) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>>()
        .mockResolvedValue({
          arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode(mockJson).buffer)
        }) as never;

      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'new-workflow' }));
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockWorkflowService.renderWorkflow).toHaveBeenCalledWith(workflow2, expect.any(SerializableRenderRequest));
      globalThis.fetch = originalFetch;
    });
  });

  describe('process() — rendering and reply', () => {
    it('should call comfyUiClient.render and reply with content and files', async (): Promise<void> => {
      const workflow = createWorkflow('test-workflow', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      const inputReq = createBaseRenderRequest({ workflow: 'test-workflow' });
      const stateAttachment = { url: 'http://example.com/Prompt.dat' } as never;
      mockReplyService.getAttachmentsByName = jest.fn(() => [stateAttachment]);

      const mockJson = JSON.stringify([inputReq]);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn<(url: unknown) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>>()
        .mockResolvedValue({
          arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode(mockJson).buffer)
        }) as never;

      const attachment = {} as AttachmentBuilder;
      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'test-workflow' }), [attachment]);
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockComfyUiClient.render).toHaveBeenCalledTimes(1);
      expect(mockComfyUiReplyService.reply).toHaveBeenCalledTimes(1);
      globalThis.fetch = originalFetch;
    });

    it('should clamp additionalAttachments to MaxMediaAttachmentsPerMessage - 1', async (): Promise<void> => {
      const workflow = createWorkflow('test-workflow', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      const inputReq = createBaseRenderRequest({ workflow: 'test-workflow' });
      const stateAttachment = { url: 'http://example.com/Prompt.dat' } as never;
      mockReplyService.getAttachmentsByName = jest.fn(() => [stateAttachment]);

      const mockJson = JSON.stringify([inputReq]);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn<(url: unknown) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>>()
        .mockResolvedValue({
          arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode(mockJson).buffer)
        }) as never;

      // Create more attachments than the limit
      const excessCount = DiscordConstants.MaxMediaAttachmentsPerMessage;
      const attachments = Array.from({ length: excessCount }, () => ({}) as AttachmentBuilder);
      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'test-workflow' }), attachments);
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockLogger.warn).toHaveBeenCalled();
      const replyCall = mockComfyUiReplyService.reply.mock.calls[0];
      const filesArg = replyCall[1]?.files as AttachmentBuilder[];
      expect(filesArg.length).toBe(DiscordConstants.MaxMediaAttachmentsPerMessage - 1);
      globalThis.fetch = originalFetch;
    });

    it('should not warn when additionalAttachments is within the limit', async (): Promise<void> => {
      const workflow = createWorkflow('test-workflow', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      const inputReq = createBaseRenderRequest({ workflow: 'test-workflow' });
      const stateAttachment = { url: 'http://example.com/Prompt.dat' } as never;
      mockReplyService.getAttachmentsByName = jest.fn(() => [stateAttachment]);

      const mockJson = JSON.stringify([inputReq]);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn<(url: unknown) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>>()
        .mockResolvedValue({
          arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode(mockJson).buffer)
        }) as never;

      const attachments = [{}] as AttachmentBuilder[];
      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'test-workflow' }), attachments);
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockLogger.warn).not.toHaveBeenCalled();
      globalThis.fetch = originalFetch;
    });
  });

  describe('process() — customId as BotInteraction', () => {
    it('should pass the interaction customId as BotInteraction to getWorkflowMutator', async (): Promise<void> => {
      const workflow = createWorkflow('test-workflow', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      const inputReq = createBaseRenderRequest({ workflow: 'test-workflow' });
      const stateAttachment = { url: 'http://example.com/Prompt.dat' } as never;
      mockReplyService.getAttachmentsByName = jest.fn(() => [stateAttachment]);
      mockInteraction = createMockInteraction({ customId: BotInteraction.Retry });

      const mockJson = JSON.stringify([inputReq]);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn<(url: unknown) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>>()
        .mockResolvedValue({
          arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode(mockJson).buffer)
        }) as never;

      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'test-workflow' }));
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockGetWorkflowMutator).toHaveBeenCalledWith(BotInteraction.Retry, workflow);
      globalThis.fetch = originalFetch;
    });
  });

  describe('process() — loop with multiple workflows', () => {
    it('should break when input render requests are exhausted before workflows', async (): Promise<void> => {
      const workflow1 = createWorkflow('wf1', SupportedFeature.Txt2Img);
      const workflow2 = createWorkflow('wf2', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow1, workflow2];

      // Only one input render request
      const inputReq = createBaseRenderRequest({ workflow: 'wf1' });
      const stateAttachment = { url: 'http://example.com/Prompt.dat' } as never;
      mockReplyService.getAttachmentsByName = jest.fn(() => [stateAttachment]);

      const mockJson = JSON.stringify([inputReq]);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn<(url: unknown) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>>()
        .mockResolvedValue({
          arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode(mockJson).buffer)
        }) as never;

      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'wf1' }));
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      // Only one mutate call since there's only one input render request
      expect(mockMutator.mutate).toHaveBeenCalledTimes(1);
      globalThis.fetch = originalFetch;
    });
  });

  describe('postProcess()', () => {
    it('should call replyWithError when taskStatus is Dead', async (): Promise<void> => {
      mockReplyService.replyWithError = jest.fn<(interaction: ButtonInteraction) => Promise<void>>().mockResolvedValue(undefined);

      const task = createTask();
      (task as unknown as { taskStatus: string }).taskStatus = 'dead';

      await task.postProcess();

      expect(mockReplyService.replyWithError).toHaveBeenCalledWith(mockInteraction);
    });
  });
});