import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Message as DiscordMessage } from 'discord.js';

import { NodeEnvironment } from '../../../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../../../enums/TaskQueueStrategy.js';
import type { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import type { IFeatureService } from '../../../features/IFeatureService.js';
import type { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import type { ILogger } from '../../../ILogger.js';
import type { IParallelizationStrategy } from '../../../parallelization/IParallelizationStrategy.js';
import type { ITaskChannelPostProcessor } from '../../../parallelization/ITaskChannelPostProcessor.js';
import type { ComfyUiClient } from '../../media/comfy-ui/ComfyUiClient.js';
import { LlmRole } from '../enums/LlmRole.js';
import type { ILlmClient } from '../ILlmClient.js';
import type { LlmChatMessage } from '../models/LlmChatMessage.js';
import type { LlmMessage } from '../models/LlmMessage.js';
import type { LlmStreamChunk } from '../models/LlmStreamChunk.js';
import { LlmMessageTask } from './LlmMessageTask.js';

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
  getContextByChannelId: jest.Mock<() => LlmMessage[]>;
  addContext: jest.Mock;
  createLlmChatMessage: jest.Mock;
  fromChatMessage: jest.Mock;
  fromLlmMessage: jest.Mock;
  fromSummary: jest.Mock;
  sendMessage: jest.Mock;
  sendMessageAndGetStream: jest.Mock;
  llmReplyServiceReply: jest.Mock;
  llmStreamingReplyServiceReply: jest.Mock;
  llmStreamingReplyServiceClearState: jest.Mock;
}

function buildMockServices(streamsResponse: boolean, contextMessages: LlmMessage[] = []): MockServices {
  const logger = createMockLogger();

  const compress = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const getContextByChannelId = jest.fn<() => LlmMessage[]>(() => [...contextMessages]);
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

  const fakeResponseMessage: LlmMessage = { role: LlmRole.Assistant, content: 'response' };

  const sendMessage = jest.fn<() => Promise<unknown>>().mockResolvedValue({
    exchange: {
      request: { model: 'test', messages: [] },
      response: {
        message: fakeResponseMessage,
        promptTokens: 10,
        completionTokens: 5
      },
    },
    data: [],
  });

  function* fakeStream(): Generator<LlmStreamChunk> {
    yield { content: 'response', done: false };
    yield { content: '', done: true, promptTokens: 10, completionTokens: 5 };
  }

  const sendMessageAndGetStream = jest.fn<() => Promise<unknown>>().mockResolvedValue({
    exchange: {
      request: { model: 'test', messages: [] },
      response: fakeStream(),
    },
    data: [],
  });

  const llmReplyServiceReply = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
  const llmStreamingReplyServiceReply = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
  const llmStreamingReplyServiceClearState = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

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
    llmHosts: [{ url: new URL('http://localhost:11434'), token: null, isLocal: null }],
    llmModels: ['test-model'],
    llmSystemPrompt: '',
    llmStreamsResponse: streamsResponse,
    llmEmbeddingModel: null,
    llmTopK: 5,
    llmContextWindow: 100000,
    llmContextCompressionThreshold: 0.75,
    applicationName: 'Musebot',
    isProduction: false,
  } as unknown as IConfigurationService;

  const featureService = { hasFeature: jest.fn(() => false) } as unknown as jest.Mocked<IFeatureService>;
  const comfyUiClient = {
    host: new URL('http://localhost:8188'),
    free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  } as unknown as jest.Mocked<ComfyUiClient>;
  const llmClient = {
    host: new URL('http://localhost:11434'),
    model: 'test-model',
    free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    generate: jest.fn(),
    generateStructured: jest.fn(),
    sendMessage,
    sendMessageAndGetStream,
    isModelLoaded: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    show: jest.fn(),
  } as unknown as jest.Mocked<ILlmClient>;

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

  const llmReplyService = { reply: llmReplyServiceReply };
  const llmStreamingReplyService = {
    reply: llmStreamingReplyServiceReply,
    clearState: llmStreamingReplyServiceClearState,
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
    llmHostFlavorRegistry: null as never,
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
    llmClient,
    llmReplyService: llmReplyService as never,
    llmStreamingReplyService: llmStreamingReplyService as never,
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
    llmReplyServiceReply,
    llmStreamingReplyServiceReply,
    llmStreamingReplyServiceClearState,
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

describe('LlmMessageTask', () => {
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
      const task = new LlmMessageTask(mocks.container, mockDiscordMessage);

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
      const task = new LlmMessageTask(mocks.container, mockDiscordMessage);

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