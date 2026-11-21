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
  llmStreamingReplyServiceShowReasoning: jest.Mock;
  llmStreamingReplyServiceClearState: jest.Mock;
}

function buildMockServices(streamsResponse: boolean, contextMessages: LlmMessage[] = [], reasoningViewLines: number = 25): MockServices {
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
  const llmStreamingReplyServiceShowReasoning = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
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
    llmReasoningViewLines: reasoningViewLines,
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
    showReasoning: llmStreamingReplyServiceShowReasoning,
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
    llmStreamingReplyServiceShowReasoning,
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

  describe('process() streaming edit pacing', (): void => {
    it('paces streaming edits so a fast token stream cannot flood Discord, without losing content', async (): Promise<void> => {
      jest.useFakeTimers();

      try {
        const chunkCount = 300;
        const chunkIntervalMs = 5;
        const fullContent = 'a'.repeat(chunkCount) + 'DONE';

        const mocks = buildMockServices(true);

        async function* fastStream(): AsyncGenerator<LlmStreamChunk> {
          for (let i = 0; i < chunkCount; i++) {
            await new Promise<void>((resolve) => setTimeout(resolve, chunkIntervalMs));
            yield { content: 'a', done: false } as LlmStreamChunk;
          }

          yield { content: 'DONE', done: true, promptTokens: 10, completionTokens: 5 } as LlmStreamChunk;
        }

        mocks.sendMessageAndGetStream.mockImplementationOnce(() => Promise.resolve({
          exchange: { request: { model: 'test', messages: [] }, response: fastStream() },
          data: [],
        } as unknown));

        const task = new LlmMessageTask(mocks.container, mockDiscordMessage);
        const processed = task.process();

        await jest.advanceTimersByTimeAsync(chunkCount * chunkIntervalMs + 100);
        await processed;

        const flushed = mocks.llmStreamingReplyServiceReply.mock.calls.map(
          (call: unknown[]) => call[1] as string
        );

        // Discord's message-edit bucket allows at most ~5 edits per 5 seconds
        // per channel, so an edit roughly every 1000ms is the sustainable
        // ceiling while streaming.
        const minimumEditIntervalMs = 1000;
        const maxFlushes = Math.ceil(chunkCount * chunkIntervalMs / minimumEditIntervalMs) + 1;

        expect(flushed.length).toBeLessThanOrEqual(maxFlushes);

        // Every character of every chunk must land in exactly one flushed batch.
        expect(flushed.join('')).toBe(fullContent);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('process() streaming reasoning display', (): void => {
    it('shows a sliding reasoning view and replaces it in place with the answer', async (): Promise<void> => {
      jest.useFakeTimers();

      try {
        const reasoningChunkCount = 260;
        const contentChunkCount = 30;
        const chunkIntervalMs = 5;

        const mocks = buildMockServices(true);

        async function* reasoningStream(): AsyncGenerator<LlmStreamChunk> {
          for (let i = 0; i < reasoningChunkCount; i++) {
            await new Promise<void>((resolve) => setTimeout(resolve, chunkIntervalMs));
            yield { content: '', done: false, reasoning: `Thought ${i}.\n` } as LlmStreamChunk;
          }

          for (let i = 0; i < contentChunkCount; i++) {
            await new Promise<void>((resolve) => setTimeout(resolve, chunkIntervalMs));
            yield { content: 'a', done: false } as LlmStreamChunk;
          }

          yield { content: 'DONE', done: true, promptTokens: 10, completionTokens: 5 } as LlmStreamChunk;
        }

        mocks.sendMessageAndGetStream.mockImplementationOnce(() => Promise.resolve({
          exchange: { request: { model: 'test', messages: [] }, response: reasoningStream() },
          data: [],
        } as unknown));

        const task = new LlmMessageTask(mocks.container, mockDiscordMessage);
        const processed = task.process();

        await jest.advanceTimersByTimeAsync((reasoningChunkCount + contentChunkCount) * chunkIntervalMs + 100);
        await processed;

        const reasoningViews = mocks.llmStreamingReplyServiceShowReasoning.mock.calls.map(
          (call: unknown[]) => call[1] as string
        );
        const flushed = mocks.llmStreamingReplyServiceReply.mock.calls.map(
          (call: unknown[]) => call[1] as string
        );

        // The reasoning phase spans ~1300ms of the paced edit budget: the
        // sliding view is shown at the ~1s edit boundary. Reasoning edits
        // share the same edit budget as content edits, so at most one
        // reasoning view fits before the answer replaces it.
        expect(reasoningViews.length).toBeGreaterThanOrEqual(1);
        expect(reasoningViews.length).toBeLessThanOrEqual(2);

        // The view is a sliding window: labeled, fenced, holding the
        // most recent reasoning, and always under Discord's message limit.
        const lastView = reasoningViews[reasoningViews.length - 1];
        expect(lastView.startsWith('🤔 *Thinking…*\n\n```markdown\n')).toBe(true);
        expect(lastView).not.toContain('\n\n…');
        expect(lastView).toContain('Thought 199.');
        expect(lastView).not.toContain('Thought 259.');
        expect(lastView.length).toBeLessThanOrEqual(2000);

        // Replace in place: reasoning views stop once the answer starts, the
        // answer batches carry no reasoning text, and no reasoning-driven
        // reply() flush leaks an empty answer over the reasoning view.
        const firstReplyOrder = mocks.llmStreamingReplyServiceReply.mock.invocationCallOrder[0];

        for (const order of mocks.llmStreamingReplyServiceShowReasoning.mock.invocationCallOrder) {
          expect(order).toBeLessThan(firstReplyOrder);
        }

        expect(flushed.join('')).toBe('a'.repeat(contentChunkCount) + 'DONE');
        expect(flushed.join('')).not.toContain('Thought');
      } finally {
        jest.useRealTimers();
      }
    });

    it('finalizes the reasoning view when the stream ends without answer content', async (): Promise<void> => {
      const mocks = buildMockServices(true);

      async function* reasoningOnlyStream(): AsyncGenerator<LlmStreamChunk> {
        for (let i = 0; i < 3; i++) {
          await Promise.resolve();
          yield { content: '', done: false, reasoning: `Thought ${i}.\n` } as LlmStreamChunk;
        }

        yield { content: '', done: true, promptTokens: 4, completionTokens: 6 } as LlmStreamChunk;
      }

      mocks.sendMessageAndGetStream.mockImplementationOnce(() => Promise.resolve({
        exchange: { request: { model: 'test', messages: [] }, response: reasoningOnlyStream() },
        data: [],
      } as unknown));

      const task = new LlmMessageTask(mocks.container, mockDiscordMessage);
      await task.process();

      // No paced flush fits inside the sub-second reasoning phase, so the
      // done path finalizes the reasoning view instead of sending an empty
      // answer edit.
      expect(mocks.llmStreamingReplyServiceReply).toHaveBeenCalledTimes(0);
      expect(mocks.llmStreamingReplyServiceShowReasoning).toHaveBeenCalledTimes(1);

      const view = mocks.llmStreamingReplyServiceShowReasoning.mock.calls[0][1] as string;

      expect(view.startsWith('🤔 *Thinking…*\n\n```markdown\n')).toBe(true);
      expect(view).toContain('Thought 2.');
    });

    it('caps the reasoning view to the configured line count', async (): Promise<void> => {
      const mocks = buildMockServices(true, [], 10);

      async function* longReasoningStream(): AsyncGenerator<LlmStreamChunk> {
        for (let i = 0; i < 30; i++) {
          await Promise.resolve();
          yield { content: '', done: false, reasoning: `Thought ${i}.\n` } as LlmStreamChunk;
        }

        yield { content: '', done: true, promptTokens: 4, completionTokens: 6 } as LlmStreamChunk;
      }

      mocks.sendMessageAndGetStream.mockImplementationOnce(() => Promise.resolve({
        exchange: { request: { model: 'test', messages: [] }, response: longReasoningStream() },
        data: [],
      } as unknown));

      const task = new LlmMessageTask(mocks.container, mockDiscordMessage);
      await task.process();

      const view = mocks.llmStreamingReplyServiceShowReasoning.mock.calls[0][1] as string;

      // The tail lives inside a ```markdown fence; quote prefixes are gone.
      expect(view.startsWith('🤔 *Thinking…*\n\n```markdown\n')).toBe(true);
      expect(view.endsWith('\n```')).toBe(true);

      const fenceOpen = '```markdown\n';
      const body = view.slice(view.indexOf(fenceOpen) + fenceOpen.length, view.lastIndexOf('\n```'));
      const bodyLines = body.split('\n');

      expect(bodyLines.length).toBe(10);
      expect(bodyLines[bodyLines.length - 1]).toBe('Thought 29.');
      expect(view).not.toContain('Thought 0.');

      // A trailing newline in reasoning must not render a dangling blank
      // row inside the fence, nor let it consume one of the capped slots.
      expect(bodyLines.filter((line) => line.length === 0).length).toBe(0);
    });

    it('locks the reasoning view height at the configured line count', async (): Promise<void> => {
      const mocks = buildMockServices(true);

      async function* shortReasoningStream(): AsyncGenerator<LlmStreamChunk> {
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
          yield { content: '', done: false, reasoning: `Thought ${i}.\n` } as LlmStreamChunk;
        }

        yield { content: '', done: true, promptTokens: 4, completionTokens: 6 } as LlmStreamChunk;
      }

      mocks.sendMessageAndGetStream.mockImplementationOnce(() => Promise.resolve({
        exchange: { request: { model: 'test', messages: [] }, response: shortReasoningStream() },
        data: [],
      } as unknown));

      const task = new LlmMessageTask(mocks.container, mockDiscordMessage);
      await task.process();

      // Fewer lines than the cap: the view still renders exactly cap-height
      // rows, padded above the tail, so the box never resizes mid-stream.
      const view = mocks.llmStreamingReplyServiceShowReasoning.mock.calls[0][1] as string;
      const fenceOpen = '```markdown\n';
      const body = view.slice(view.indexOf(fenceOpen) + fenceOpen.length, view.lastIndexOf('\n```'));
      const bodyLines = body.split('\n');

      expect(bodyLines.length).toBe(25);
      expect(bodyLines[0]).toBe('');
      expect(bodyLines[bodyLines.length - 1]).toBe('Thought 4.');
    });

    it('disables the reasoning view entirely when reasoningViewLines is 0', async (): Promise<void> => {
      const mocks = buildMockServices(true, [], 0);

      async function* disabledReasoningStream(): AsyncGenerator<LlmStreamChunk> {
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
          yield { content: '', done: false, reasoning: `Thought ${i}.\n` } as LlmStreamChunk;
        }

        yield { content: '', done: true, promptTokens: 4, completionTokens: 6 } as LlmStreamChunk;
      }

      mocks.sendMessageAndGetStream.mockImplementationOnce(() => Promise.resolve({
        exchange: { request: { model: 'test', messages: [] }, response: disabledReasoningStream() },
        data: [],
      } as unknown));

      const task = new LlmMessageTask(mocks.container, mockDiscordMessage);
      await task.process();

      // Zero disables the reasoning view: no edits spent on reasoning at all.
      expect(mocks.llmStreamingReplyServiceShowReasoning).toHaveBeenCalledTimes(0);
    });

    it('keeps reasoning that arrives in the same delta as the first answer content', async (): Promise<void> => {
      const mocks = buildMockServices(true);

      async function* sameDeltaStream(): AsyncGenerator<LlmStreamChunk> {
        await Promise.resolve();
        yield { content: 'Hi', done: false, reasoning: 'openrouter thought' } as LlmStreamChunk;
        yield { content: '', done: true, promptTokens: 4, completionTokens: 6 } as LlmStreamChunk;
      }

      mocks.sendMessageAndGetStream.mockImplementationOnce(() => Promise.resolve({
        exchange: { request: { model: 'test', messages: [] }, response: sameDeltaStream() },
        data: [],
      } as unknown));

      const task = new LlmMessageTask(mocks.container, mockDiscordMessage);
      await task.process();

      // A delta carrying both reasoning and the first content must still add
      // its reasoning to the view before the answer replaces it.
      expect(mocks.llmStreamingReplyServiceShowReasoning).toHaveBeenCalledTimes(1);
      const view = mocks.llmStreamingReplyServiceShowReasoning.mock.calls[0][1] as string;
      expect(view).toContain('openrouter thought');
    });
  });
});
