import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import type { ILogger } from '../../../ILogger.js';
import { ContextMessage } from '../ollama/models/ContextMessage.js';
import { ContextService } from './ContextService.js';

type TestMessage = { role: string; content: string };

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

function createMockServices(logger: jest.Mocked<ILogger>): IBotServiceContainer {
  return {
    configurationService: null as never,
    featureService: null as never,
    taskQueue: null as never,
    typingService: null as never,
    discordClient: null as never,
    generativeChatClient: null as never,
    helpService: null as never,
    workflowService: null as never,
    webContentService: null as never,
    parallelizationStrategy: null as never,
    getLogger: jest.fn(() => logger),
    getTaskChannelPostProcessor: (() => null as never) as unknown as () => never,
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
    comfyUiClient: null as never,
    comfyUiReplyService: null as never,
    ollamaClient: null as never,
    ollamaReplyService: null as never,
    ollamaStreamingReplyService: null as never,
    actionRowBuilderFactory: null as never,
    getChatMessageFilters: () => [],
    getInputChatMessageFilters: () => [],
    getChatMessageFactory: () => null as never,
    getLlmChatMessageFactory: () => null as never,
    getMemoryService: () => null as never,
  };
}

function makeMessage(
  channelId: string | null,
  isReadOnly: boolean,
  isPrivate: boolean,
  content: string,
  isSummary: boolean = false
): ContextMessage<unknown, TestMessage> {
  return {
    messageId: null,
    associatedMessageId: null,
    userId: null,
    associatedUserId: null,
    channelId,
    serverId: null,
    timestamp: new Date(),
    chatMessage: null,
    llmMessage: { role: 'system', content },
    isReadOnly,
    isPrivate,
    isSummary,
  };
}

describe('ContextService', (): void => {
  let logger: jest.Mocked<ILogger>;
  let services: IBotServiceContainer;
  let contextService: ContextService<unknown, TestMessage>;

  beforeEach((): void => {
    logger = createMockLogger();
    services = createMockServices(logger);
    contextService = new ContextService<unknown, TestMessage>(services);
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('getContextByChannelId', (): void => {
    it('should return the system prompt for a channel', (): void => {
      contextService.addContext([makeMessage(null, true, false, 'system prompt')]);

      const result: TestMessage[] = contextService.getContextByChannelId('channel-1');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('system prompt');
    });

    it('should return system prompt and channel messages for a guild channel', (): void => {
      contextService.addContext([
        makeMessage(null, true, false, 'system prompt'),
        makeMessage('channel-1', false, false, 'hello'),
        makeMessage('channel-1', false, false, 'world'),
      ]);

      const result: TestMessage[] = contextService.getContextByChannelId('channel-1');

      expect(result).toHaveLength(3);
      expect(result.map((m) => m.content)).toEqual(['system prompt', 'hello', 'world']);
    });

    it('should not return messages from other channels', (): void => {
      contextService.addContext([
        makeMessage(null, true, false, 'system prompt'),
        makeMessage('channel-1', false, false, 'message in channel 1'),
        makeMessage('channel-2', false, false, 'message in channel 2'),
      ]);

      const result: TestMessage[] = contextService.getContextByChannelId('channel-1');

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.content)).toEqual(['system prompt', 'message in channel 1']);
    });

    it('should return private messages from the matching DM channel', (): void => {
      contextService.addContext([
        makeMessage(null, true, false, 'system prompt'),
        makeMessage('dm-channel-1', false, true, 'private hello'),
        makeMessage('dm-channel-1', false, true, 'private world'),
      ]);

      const result: TestMessage[] = contextService.getContextByChannelId('dm-channel-1');

      expect(result).toHaveLength(3);
      expect(result.map((m) => m.content)).toEqual(['system prompt', 'private hello', 'private world']);
    });

    it('should not return private messages from a different DM channel', (): void => {
      contextService.addContext([
        makeMessage(null, true, false, 'system prompt'),
        makeMessage('dm-channel-1', false, true, 'private hello for channel 1'),
        makeMessage('dm-channel-2', false, true, 'private hello for channel 2'),
      ]);

      const result: TestMessage[] = contextService.getContextByChannelId('dm-channel-1');

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.content)).toEqual(['system prompt', 'private hello for channel 1']);
    });

    it('should not return private messages via the system prompt (channelId=null) path', (): void => {
      contextService.addContext([
        makeMessage(null, true, false, 'system prompt'),
        makeMessage('dm-channel-1', false, true, 'private message'),
      ]);

      const result: TestMessage[] = contextService.getContextByChannelId('some-other-channel');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('system prompt');
    });
  });

  describe('getConversationMessages', (): void => {
    it('should return only non-readOnly non-private messages for the channel', (): void => {
      contextService.addContext([
        makeMessage(null, true, false, 'system prompt'),
        makeMessage('channel-1', false, false, 'message 1'),
        makeMessage('channel-1', false, true, 'private message'),
      ]);

      const result: ContextMessage<unknown, TestMessage>[] = contextService.getConversationMessages('channel-1');

      expect(result).toHaveLength(1);
      expect(result[0].llmMessage.content).toBe('message 1');
    });

    it('should include summary messages in the result', (): void => {
      contextService.addContext([
        makeMessage('channel-1', false, false, 'message 1'),
        makeMessage('channel-1', false, false, 'summary content', true),
      ]);

      const result: ContextMessage<unknown, TestMessage>[] = contextService.getConversationMessages('channel-1');

      expect(result).toHaveLength(2);
    });

    it('should return an empty array when no conversation messages exist', (): void => {
      contextService.addContext([
        makeMessage(null, true, false, 'system prompt'),
      ]);

      const result: ContextMessage<unknown, TestMessage>[] = contextService.getConversationMessages('channel-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('replaceChannelContext', (): void => {
    it('should replace all conversation messages for the channel with new messages', (): void => {
      contextService.addContext([
        makeMessage(null, true, false, 'system prompt'),
        makeMessage('channel-1', false, false, 'old message 1'),
        makeMessage('channel-1', false, false, 'old message 2'),
        makeMessage('channel-2', false, false, 'other channel message'),
      ]);

      const summary: ContextMessage<unknown, TestMessage> = makeMessage('channel-1', false, false, 'summary', true);
      contextService.replaceChannelContext('channel-1', [summary]);

      const result: TestMessage[] = contextService.getContextByChannelId('channel-1');

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.content)).toEqual(['system prompt', 'summary']);
    });

    it('should not affect other channels', (): void => {
      contextService.addContext([
        makeMessage('channel-1', false, false, 'channel 1 message'),
        makeMessage('channel-2', false, false, 'channel 2 message'),
      ]);

      const summary: ContextMessage<unknown, TestMessage> = makeMessage('channel-1', false, false, 'summary', true);
      contextService.replaceChannelContext('channel-1', [summary]);

      const result: TestMessage[] = contextService.getContextByChannelId('channel-2');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('channel 2 message');
    });
  });

  describe('clearContext', (): void => {
    it('should remove conversation messages but keep read-only system prompt', (): void => {
      contextService.addContext([
        makeMessage(null, true, false, 'system prompt'),
        makeMessage('channel-1', false, false, 'message 1'),
        makeMessage('channel-1', false, false, 'message 2'),
      ]);

      contextService.clearContext('channel-1');

      const result: TestMessage[] = contextService.getContextByChannelId('channel-1');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('system prompt');
    });
  });
});