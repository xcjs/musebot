import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Attachment, ButtonInteraction, Message, MessageReaction, MessageType } from 'discord.js';

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
import type { IReplyService } from '../../../chat/IReplyService.js';
import type { ComfyUiClient } from '../ComfyUiClient.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import type { IWorkflowService } from '../services/IWorkflowService.js';
import type { IWorkflowMutator } from '../services/workflow-mutators/IWorkflowMutator.js';
import { ComfyUiMessageTask } from './ComfyUiMessageTask.js';

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
    getMessageWithoutBotMentions: jest.fn(() => 'a prompt'),
    getImageAttachments: jest.fn(() => []),
    getAttachedImagesAsBase64: jest.fn<(message: Message) => Promise<string[]>>().mockResolvedValue([]),
    getPreviousMessage: jest.fn<(message: Message) => Promise<Message | null>>().mockResolvedValue(null),
    replyWithError: jest.fn<(message: Message) => Promise<void>>().mockResolvedValue(undefined),
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

function createMockMutator(mutateResult: SerializableRenderRequest | null = null): jest.Mocked<IWorkflowMutator> {
  return {
    interactions: [],
    types: [],
    contentMessage: '',
    additionalAttachments: [],
    mutate: jest.fn<(renderRequest: SerializableRenderRequest, interaction: Message, workflow: unknown) => Promise<SerializableRenderRequest | null>>()
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

function createMockMessage(overrides: Record<string, unknown> = {}): jest.Mocked<Message> {
  return {
    reply: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    type: MessageType.Default,
    ...overrides,
  } as unknown as jest.Mocked<Message>;
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
    getContextCompressionService: () => null as never,
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

describe('ComfyUiMessageTask', () => {
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
  let mockMessage: jest.Mocked<Message>;

  function createTask(): ComfyUiMessageTask {
    return new ComfyUiMessageTask(createMockServices(
      mockConfig, mockLogger, mockFeatureService, mockReplyService,
      mockComfyUiClient, mockComfyUiReplyService, mockWorkflowService,
      mockOllamaClient, mockGetWorkflowMutator
    ), mockMessage);
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
    mockMutator = createMockMutator(createBaseRenderRequest());
    mockGetWorkflowMutator = jest.fn(() => mockMutator);
    mockMessage = createMockMessage();
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('process() — interaction type detection', () => {
    it('should use ImageMessage path when message has image attachments and no text prompt', async (): Promise<void> => {
      const imageAttachment = { url: 'http://example.com/img.png' } as never;
      mockReplyService.getImageAttachments = jest.fn(() => [imageAttachment]);
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => '');

      await createTask().process();

      expect(mockComfyUiReplyService.replyWithImageActionRows).toHaveBeenCalledWith(mockMessage, [imageAttachment]);
    });

    it('should use ImageMessageWithPrompt when images + text + ContextualImg2Img feature', async (): Promise<void> => {
      mockFeatureService = createMockFeatureService({ [SupportedFeature.ContextualImg2Img]: true });
      const imageAttachment = { url: 'http://example.com/img.png' } as never;
      mockReplyService.getImageAttachments = jest.fn(() => [imageAttachment]);
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => 'a prompt');
      const workflow = createWorkflow('img2img-wf', SupportedFeature.ContextualImg2Img);
      mockWorkflowService.workflows = [workflow];
      const defaultReq = createBaseRenderRequest({ num: 1 });
      mockWorkflowService.getWorkflowDefaults = jest.fn(() => defaultReq);
      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'img2img-wf' }));
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockGetWorkflowMutator).toHaveBeenCalledWith(BotInteraction.ImageMessageWithPrompt, workflow);
    });

    it('should use JsonMessage path when text prompt starts with {', async (): Promise<void> => {
      const jsonReq = createBaseRenderRequest({ prompt: 'json prompt', workflow: 'json-wf' });
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => JSON.stringify(jsonReq));
      const workflow = createWorkflow('json-wf', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'json-wf' }));
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockGetWorkflowMutator).toHaveBeenCalledWith(BotInteraction.JsonMessage, workflow);
    });

    it('should use Reply path when message is a reply and no ContextualImg2Img feature', async (): Promise<void> => {
      mockMessage = createMockMessage({ type: MessageType.Reply });
      const workflow = createWorkflow('txt2img-wf', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'txt2img-wf' }));
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockGetWorkflowMutator).toHaveBeenCalledWith(BotInteraction.Reply, workflow);
    });

    it('should use ContextualReply when reply message has images and ContextualImg2Img is available', async (): Promise<void> => {
      mockFeatureService = createMockFeatureService({ [SupportedFeature.ContextualImg2Img]: true });
      mockMessage = createMockMessage({ type: MessageType.Reply });
      const prevMessage = createMockMessage();
      const imageAttachment = { url: 'http://example.com/img.png' } as never;
      mockReplyService.getPreviousMessage = jest.fn<(message: Message) => Promise<Message | null>>().mockResolvedValue(prevMessage);
      mockReplyService.getImageAttachments = jest.fn((msg: Message): unknown[] => {
        return msg === prevMessage ? [imageAttachment] : [];
      }) as never;
      mockReplyService.getAttachedImagesAsBase64 = jest.fn<(message: Message) => Promise<string[]>>().mockResolvedValue(['base64data']);
      const workflow = createWorkflow('ctx-wf', SupportedFeature.ContextualImg2Img);
      mockWorkflowService.workflows = [workflow];
      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'ctx-wf' }));
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockGetWorkflowMutator).toHaveBeenCalledWith(BotInteraction.ContextualReply, workflow);
    });

    it('should use Reply when reply message has no images even with ContextualImg2Img', async (): Promise<void> => {
      mockFeatureService = createMockFeatureService({ [SupportedFeature.ContextualImg2Img]: true });
      mockMessage = createMockMessage({ type: MessageType.Reply });
      const prevMessage = createMockMessage();
      mockReplyService.getPreviousMessage = jest.fn<(message: Message) => Promise<Message | null>>().mockResolvedValue(prevMessage);
      mockReplyService.getImageAttachments = jest.fn(() => []);
      const workflow = createWorkflow('txt2img-wf', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'txt2img-wf' }));
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockGetWorkflowMutator).toHaveBeenCalledWith(BotInteraction.Reply, workflow);
    });

    it('should use default Message path when text prompt is plain text with no images', async (): Promise<void> => {
      const workflow = createWorkflow('txt2img-wf', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      mockMutator = createMockMutator(createBaseRenderRequest({ workflow: 'txt2img-wf' }));
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockGetWorkflowMutator).toHaveBeenCalledWith(BotInteraction.Message, workflow);
    });
  });

  describe('process() — null handling (the fix)', () => {
    it('should continue when mutator.mutate() returns null instead of crashing', async (): Promise<void> => {
      const workflow = createWorkflow('txt2img-wf', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      mockMutator = createMockMutator(null);
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await expect(createTask().process()).rejects.toThrow('There are no actionable prompts found.');
    });

    it('should continue when workflow is null after mutate returns a non-existent workflow name', async (): Promise<void> => {
      const workflow = createWorkflow('txt2img-wf', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      const mutatedReq = createBaseRenderRequest({ workflow: 'nonexistent-workflow' });
      mockMutator = createMockMutator(mutatedReq);
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await expect(createTask().process()).rejects.toThrow('There are no actionable prompts found.');
    });

    it('should not render when all mutator results are null', async (): Promise<void> => {
      const workflow = createWorkflow('txt2img-wf', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      mockMutator = createMockMutator(null);
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      try {
        await createTask().process();
      } catch {
        // Expected throw
      }

      expect(mockComfyUiClient.render).not.toHaveBeenCalled();
    });
  });

  describe('process() — workflow null checks', () => {
    it('should return early when no txt2* workflow is found for default Message path', async (): Promise<void> => {
      mockWorkflowService.workflows = [];

      await createTask().process();

      expect(mockGetWorkflowMutator).not.toHaveBeenCalled();
    });

    it('should return early when no ContextualImg2Img workflow is found for ImageMessageWithPrompt', async (): Promise<void> => {
      mockFeatureService = createMockFeatureService({ [SupportedFeature.ContextualImg2Img]: true });
      const imageAttachment = { url: 'http://example.com/img.png' } as never;
      mockReplyService.getImageAttachments = jest.fn(() => [imageAttachment]);
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => 'a prompt');
      mockWorkflowService.workflows = [];

      await createTask().process();

      expect(mockGetWorkflowMutator).not.toHaveBeenCalled();
    });

    it('should return early when no workflow matches JsonMessage workflow name', async (): Promise<void> => {
      const jsonReq = createBaseRenderRequest({ prompt: 'json prompt', workflow: 'nonexistent-wf' });
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => JSON.stringify(jsonReq));
      mockWorkflowService.workflows = [createWorkflow('other-wf', SupportedFeature.Txt2Img)];

      await createTask().process();

      expect(mockGetWorkflowMutator).not.toHaveBeenCalled();
    });
  });

  describe('process() — rendering', () => {
    it('should call comfyUiClient.render with prompts and reply with content', async (): Promise<void> => {
      const workflow = createWorkflow('txt2img-wf', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      const mutatedReq = createBaseRenderRequest({ workflow: 'txt2img-wf' });
      mockMutator = createMockMutator(mutatedReq);
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockComfyUiClient.render).toHaveBeenCalledTimes(1);
      expect(mockComfyUiReplyService.reply).toHaveBeenCalledTimes(1);
    });

    it('should loop defaultRenderRequest.num times when num > 1', async (): Promise<void> => {
      const workflow = createWorkflow('txt2img-wf', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      const defaultReq = createBaseRenderRequest({ num: 3 });
      mockWorkflowService.getWorkflowDefaults = jest.fn(() => defaultReq);
      const mutatedReq = createBaseRenderRequest({ workflow: 'txt2img-wf' });
      mockMutator = createMockMutator(mutatedReq);
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await createTask().process();

      expect(mockMutator.mutate).toHaveBeenCalledTimes(3);
      expect(mockComfyUiClient.render).toHaveBeenCalledTimes(1);
    });

    it('should throw when no actionable prompts are found', async (): Promise<void> => {
      const workflow = createWorkflow('txt2img-wf', SupportedFeature.Txt2Img);
      mockWorkflowService.workflows = [workflow];
      mockMutator = createMockMutator(null);
      mockGetWorkflowMutator = jest.fn(() => mockMutator);

      await expect(createTask().process()).rejects.toThrow('There are no actionable prompts found.');
    });
  });

  describe('process() — ImageMessage early return', () => {
    it('should not call render for ImageMessage interaction type', async (): Promise<void> => {
      const imageAttachment = { url: 'http://example.com/img.png' } as never;
      mockReplyService.getImageAttachments = jest.fn(() => [imageAttachment]);
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => '');

      await createTask().process();

      expect(mockComfyUiClient.render).not.toHaveBeenCalled();
      expect(mockGetWorkflowMutator).not.toHaveBeenCalled();
    });
  });

  describe('postProcess()', () => {
    it('should call replyWithError when taskStatus is Dead', async (): Promise<void> => {
      mockReplyService.replyWithError = jest.fn<(message: Message) => Promise<void>>().mockResolvedValue(undefined);

      const task = createTask();
      // Access protected field via any cast for testing
      (task as unknown as { taskStatus: string }).taskStatus = 'dead';

      await task.postProcess();

      expect(mockReplyService.replyWithError).toHaveBeenCalledWith(mockMessage);
    });
  });
});