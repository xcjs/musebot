import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Message as DiscordMessage } from 'discord.js';
import type { Message as OllamaMessage } from 'ollama';

import { NodeEnvironment } from '../../../../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../../../../enums/TaskQueueStrategy.js';
import type { IConfigurationService } from '../../../../environment-settings/IConfigurationService.js';
import type { IFeatureService } from '../../../../features/IFeatureService.js';
import type { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import type { ILogger } from '../../../../ILogger.js';
import type { IParallelizationStrategy } from '../../../../parallelization/IParallelizationStrategy.js';
import type { ITaskChannelPostProcessor } from '../../../../parallelization/ITaskChannelPostProcessor.js';
import type { ComfyUiClient } from '../../../media/comfy-ui/ComfyUiClient.js';
import type { LlmChatMessage } from '../models/LlmChatMessage.js';
import type { OllamaClient } from '../OllamaClient.js';
import { OllamaMessageTask } from './OllamaMessageTask.js';

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

interface MockServices {
  container: IBotServiceContainer;
  compress: jest.Mock<() => Promise<void>>;
  getContextByChannelId: jest.Mock<() => OllamaMessage[]>;
  addContext: jest.Mock;
  createLlmChatMessage: jest.Mock;
  fromChatMessage: jest.Mock;
  fromLlmMessage: jest.Mock;
  fromSummary: jest.Mock;
  sendMessage: jest.Mock;
  sendMessageAndGetStream: jest.Mock;
  ollamaReplyServiceReply: jest.Mock;
  ollamaStreamingReplyServiceReply: jest.Mock;
  ollamaStreamingReplyServiceClearState: jest.Mock;
}

function buildMockServices(streamsResponse: boolean, contextMessages: OllamaMessage[] = []): MockServices {
  const logger = createMockLogger();

  const compress = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const getContextByChannelId = jest.fn<() => OllamaMessage[]>(() => [...contextMessages]);
  const addContext = jest.fn();
  const createLlmChatMessage = jest.fn((): LlmChatMessage => ({
    messageId: 'msg-1',
    username: 'user',
    displayName: 'User',
    userId: 'user-1',
    isBot: false,
    message: 'hello',
    datetime: '2026-01-01T00:00:00Z',
    roles: [],
    channel: { id: 'channel-1', name: 'general', topic: null },
    thread: null,
    server: { id: 'server-1', name: 'server' },
    mentions: { users: [], roles: [], everyone: false },
    attachments: [],
  }));
  const fromChatMessage = jest.fn(() => ({ role: 'user', content: 'hello' }));
  const fromLlmMessage = jest.fn(() => ({ role: 'assistant', content: 'hi' }));
  const fromSummary = jest.fn(() => ({ role: 'system', content: 'summary' }));

  const fakeResponseMessage: OllamaMessage = { role: 'assistant', content: 'response' };

  const sendMessage = jest.fn<() => Promise<unknown>>().mockResolvedValue({
    exchange: {
      request: { model: 'test', messages: [] },
      response: {
        message: fakeResponseMessage,
        prompt_eval_count: 10,
        eval_count: 5
      },
    },
    data: [],
  });

  function* fakeStream(): Generator<{ message: OllamaMessage; done: boolean; prompt_eval_count?: number; eval_count?: number }> {
    yield { message: fakeResponseMessage, done: false };
    yield { message: fakeResponseMessage, done: true, prompt_eval_count: 10, eval_count: 5 };
  }

  const sendMessageAndGetStream = jest.fn<() => Promise<unknown>>().mockResolvedValue({
    exchange: {
      request: { model: 'test', messages: [] },
      response: fakeStream(),
    },
    data: [],
  });

  const ollamaReplyServiceReply = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
  const ollamaStreamingReplyServiceReply = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
  const ollamaStreamingReplyServiceClearState = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

  const config: IConfigurationService = {
    packageName: 'musebot',
    version: '9.5.0',
    nodeEnvironment: NodeEnvironment.Test,
    botId: 'bot-1',
    botFunction: 'chat',
    maxTaskAttempts: 3,
    taskRetryDelayMilliseconds: 100,
    taskQueueStrategy: TaskQueueStrategy.Serial,
    taskQueueForceSerialAcrossHosts: false,
    discordToken: 'test-token',
    discordChannels: [],
    discordChannelsDisallowed: [],
    botRequiresMention: false,
    botResponseRate: 100,
    botPrivateMessageUsers: [],
    errorMessage: 'error',
    comfyUiHosts: [],
    comfyUiTimeoutMinutes: 30,
    comfyUiGuidanceScaleInterval: 0.5,
    randomPrompts: [],
    ollamaHosts: [new URL('http://localhost:11434')],
    ollamaModels: ['test-model'],
    ollamaSystemPrompt: '',
    ollamaStreamsResponse: streamsResponse,
    ollamaEmbeddingModel: null,
    ollamaTopK: 5,
    ollamaContextWindow: 100000,
    ollamaContextCompressionThreshold: 0.75,
    applicationName: 'Musebot',
    isProduction: false,
  } as unknown as IConfigurationService;

  const featureService = { hasFeature: jest.fn(() => false) } as unknown as jest.Mocked<IFeatureService>;
  const comfyUiClient = {
    host: new URL('http://localhost:8188'),
    free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  } as unknown as jest.Mocked<ComfyUiClient>;
  const ollamaClient = {
    host: new URL('http://localhost:11434'),
    model: 'test-model',
    free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    generate: jest.fn(),
    generateStructured: jest.fn(),
    sendMessage,
    sendMessageAndGetStream,
    isModelLoaded: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    show: jest.fn(),
  } as unknown as jest.Mocked<OllamaClient>;

  const contextService = {
    getContextByChannelId,
    addContext,
    getConversationMessages: jest.fn(() => []),
    replaceChannelContext: jest.fn(),
    clearContext: jest.fn(),
  };

  const contextMessageFactory = {
    fromChatMessage,
    fromLlmMessage,
    fromSummary,
    fromSystemPrompt: jest.fn(),
  };

  const memoryService = { isEnabled: false, store: jest.fn() };
  const webContentService = { extractUrls: jest.fn(() => []), fetchAll: jest.fn() };

  const ollamaReplyService = { reply: ollamaReplyServiceReply };
  const ollamaStreamingReplyService = {
    reply: ollamaStreamingReplyServiceReply,
    clearState: ollamaStreamingReplyServiceClearState,
  };
  const replyService = { replyWithError: jest.fn() };

  const container: IBotServiceContainer = {
    configurationService: config,
    featureService,
    taskQueue: null as never,
    typingService: null as never,
    discordClient: null as never,
    generativeChatClient: null as never,
    helpService: null as never,
    workflowService: null as never,
    webContentService: webContentService as never,
    parallelizationStrategy: { getTaskChannel: () => 'test' } as unknown as IParallelizationStrategy,
    getLogger: jest.fn(() => logger),
    getTaskChannelPostProcessor: (() => null as never) as unknown as () => ITaskChannelPostProcessor,
    getContextMessageFactory: () => contextMessageFactory as never,
    getContextService: () => contextService as never,
    getContextCompressionService: () => ({ compressIfNeeded: compress }) as never,
    getLlmGenerateTask: () => null as never,
    getLlmGenerateStructuredTask: () => null as never,
    getEmojiReactionTask: () => null as never,
    getEmbedTask: () => null as never,
    getMessageTask: () => null as never,
    getInteractionTask: () => null as never,
    getAttachmentTask: () => null as never,
    getCustomInteractionTask: () => null as never,
    getWorkflowMutator: () => null as never,
    getReplyService: () => replyService as never,
    contentTypeService: null as never,
    comfyUiClient,
    comfyUiReplyService: null as never,
    ollamaClient,
    ollamaReplyService: ollamaReplyService as never,
    ollamaStreamingReplyService: ollamaStreamingReplyService as never,
    actionRowBuilderFactory: null as never,
    getChatMessageFilters: () => [],
    getInputChatMessageFilters: () => [],
    getChatMessageFactory: () => null as never,
    getLlmChatMessageFactory: () => ({ create: createLlmChatMessage, createFromLlmResponse: jest.fn() }) as never,
    getMemoryService: () => memoryService as never,
  };

  return {
    container,
    compress,
    getContextByChannelId,
    addContext,
    createLlmChatMessage,
    fromChatMessage,
    fromLlmMessage,
    fromSummary,
    sendMessage,
    sendMessageAndGetStream,
    ollamaReplyServiceReply,
    ollamaStreamingReplyServiceReply,
    ollamaStreamingReplyServiceClearState,
  };
}

function createMockDiscordMessage(): DiscordMessage {
  return {
    id: 'msg-1',
    channelId: 'channel-1',
    author: { id: 'user-1', username: 'user' },
    guildId: 'server-1',
    channel: { id: 'channel-1', name: 'general', topic: null },
  } as unknown as DiscordMessage;
}

describe('OllamaMessageTask', () => {
  let mockDiscordMessage: DiscordMessage;

  beforeEach((): void => {
    mockDiscordMessage = createMockDiscordMessage();
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('process() pre-request compression', () => {
    it('calls compressIfNeeded BEFORE reading context (non-stream path)', async (): Promise<void> => {
      const mocks = buildMockServices(false);
      const task = new OllamaMessageTask(mocks.container, mockDiscordMessage);

      await task.process();

      const compressOrder = mocks.compress.mock.invocationCallOrder[0];
      const getContextOrder = mocks.getContextByChannelId.mock.invocationCallOrder[0];
      const sendMessageOrder = mocks.sendMessage.mock.invocationCallOrder[0];

      expect(compressOrder).toBeLessThan(getContextOrder);
      expect(getContextOrder).toBeLessThan(sendMessageOrder);
      expect(mocks.compress).toHaveBeenCalledTimes(2);
    });

    it('calls compressIfNeeded BEFORE reading context (stream path)', async (): Promise<void> => {
      const mocks = buildMockServices(true);
      const task = new OllamaMessageTask(mocks.container, mockDiscordMessage);

      await task.process();

      const compressOrder = mocks.compress.mock.invocationCallOrder[0];
      const getContextOrder = mocks.getContextByChannelId.mock.invocationCallOrder[0];
      const streamOrder = mocks.sendMessageAndGetStream.mock.invocationCallOrder[0];

      expect(compressOrder).toBeLessThan(getContextOrder);
      expect(getContextOrder).toBeLessThan(streamOrder);
      expect(mocks.compress).toHaveBeenCalledTimes(2);
    });
  });
});