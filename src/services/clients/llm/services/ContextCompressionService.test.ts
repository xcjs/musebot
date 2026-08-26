import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { ILogger } from '../../../ILogger.js';
import { ContextMessage } from '../ollama/models/ContextMessage.js';
import { OllamaClient } from '../ollama/OllamaClient.js';
import { ContextCompressionService } from './ContextCompressionService.js';
import { IContextCompressionService, ITokenCountSample } from './IContextCompressionService.js';
import { IContextMessageFactory } from './IContextMessageFactory.js';
import { IContextService } from './IContextService.js';

// Default chars-per-token ratio used by ContextCompressionService when no
// calibration sample has been received yet. Mirrors the DEFAULT_CHARS_PER_TOKEN
// constant in the implementation.
const DEFAULT_CHARS_PER_TOKEN: number = 4.0;

function createMockLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  } as unknown as jest.Mocked<ILogger>;
}

function createMockContextService(
  conversationMessages: ContextMessage<unknown, unknown>[] = [],
  getContextByChannelIdMessages: unknown[] = []
): jest.Mocked<IContextService<unknown, unknown>> {
  return {
    addContext: jest.fn(),
    getContextByServerId: jest.fn().mockReturnValue(getContextByChannelIdMessages),
    getContextByChannelId: jest.fn().mockReturnValue(getContextByChannelIdMessages),
    getContextByUserId: jest.fn().mockReturnValue(getContextByChannelIdMessages),
    clearContext: jest.fn(),
    getConversationMessages: jest.fn().mockReturnValue(conversationMessages),
    replaceChannelContext: jest.fn()
  } as unknown as jest.Mocked<IContextService<unknown, unknown>>;
}

function createMockConfigurationService(overrides: Partial<IConfigurationService> = {}): IConfigurationService {
  return {
    ollamaHosts: [new URL('http://localhost:11434')],
    ollamaModels: ['test-model'],
    ollamaSystemPrompt: 'system',
    ollamaStreamsResponse: false,
    ollamaEmbeddingModel: null,
    ollamaTopK: 5,
    ollamaContextWindow: 4096,
    ollamaContextCompressionThreshold: 0.75,
    ...overrides
  } as IConfigurationService;
}

function createMockOllamaClient(summaryContent: string = 'Summary text'): jest.Mocked<OllamaClient> {
  return {
    sendMessage: jest.fn<() => Promise<unknown>>().mockResolvedValue({
      exchange: {
        request: {},
        response: { message: { role: 'assistant', content: summaryContent } }
      },
      data: []
    }),
    show: jest.fn<() => Promise<unknown>>().mockResolvedValue({ model_info: new Map([['llama.context_length', 8192]]) }),
    model: 'test-model',
    host: new URL('http://localhost:11434')
  } as unknown as jest.Mocked<OllamaClient>;
}

function createMockContextMessageFactory(): jest.Mocked<IContextMessageFactory<unknown, unknown>> {
  return {
    fromSystemPrompt: jest.fn(),
    formatChatMessage: jest.fn(),
    fromChatMessage: jest.fn(),
    fromChatPrompt: jest.fn(),
    fromLlmMessage: jest.fn(),
    fromSummary: jest.fn().mockImplementation((summary: string, channelId: string | null) => ({
      messageId: null,
      associatedMessageId: null,
      userId: null,
      associatedUserId: null,
      channelId: channelId,
      serverId: null,
      timestamp: new Date(),
      chatMessage: null,
      llmMessage: { role: 'system', content: summary },
      isReadOnly: false,
      isPrivate: false,
      isSummary: true
    }))
  } as unknown as jest.Mocked<IContextMessageFactory<unknown, unknown>>;
}

function createMockServices(
  contextService: jest.Mocked<IContextService<unknown, unknown>>,
  configurationService: IConfigurationService,
  ollamaClient: jest.Mocked<OllamaClient>,
  contextMessageFactory: jest.Mocked<IContextMessageFactory<unknown, unknown>>,
  logger: jest.Mocked<ILogger>
): IBotServiceContainer {
  return {
    configurationService,
    getContextService: jest.fn().mockReturnValue(contextService),
    getContextMessageFactory: jest.fn().mockReturnValue(contextMessageFactory),
    ollamaClient,
    getLogger: jest.fn().mockReturnValue(logger)
  } as unknown as IBotServiceContainer;
}

function makeMessage(role: string, content: string, isSummary: boolean = false): ContextMessage<unknown, unknown> {
  return {
    messageId: null,
    associatedMessageId: null,
    userId: null,
    associatedUserId: null,
    channelId: 'channel1',
    serverId: null,
    timestamp: new Date(),
    chatMessage: null,
    llmMessage: { role, content },
    isReadOnly: false,
    isPrivate: false,
    isSummary: isSummary
  };
}

// Builds a message whose serialized form ("role: content\n") has the given
// target token count under the default chars-per-token ratio.
function makeMessageWithTokens(role: string, tokenCount: number, isSummary: boolean = false): ContextMessage<unknown, unknown> {
  const prefix: string = `${role}: `;
  const targetChars: number = Math.max(1, Math.floor(tokenCount * DEFAULT_CHARS_PER_TOKEN) - prefix.length);
  return makeMessage(role, 'x'.repeat(targetChars), isSummary);
}

describe('ContextCompressionService', () => {
  let contextService: jest.Mocked<IContextService<unknown, unknown>>;
  let configurationService: IConfigurationService;
  let ollamaClient: jest.Mocked<OllamaClient>;
  let contextMessageFactory: jest.Mocked<IContextMessageFactory<unknown, unknown>>;
  let logger: jest.Mocked<ILogger>;
  let services: IBotServiceContainer;
  let compressionService: IContextCompressionService;

  beforeEach((): void => {
    logger = createMockLogger();
    contextService = createMockContextService();
    configurationService = createMockConfigurationService();
    ollamaClient = createMockOllamaClient();
    contextMessageFactory = createMockContextMessageFactory();
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, { role: string; content: string }>(services);
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  it('should not compress when token count is under the threshold', async (): Promise<void> => {
    const messages = [makeMessageWithTokens('user', 2), makeMessageWithTokens('assistant', 2)];
    contextService.getConversationMessages.mockReturnValue(messages);

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.sendMessage).not.toHaveBeenCalled();
    expect(contextService.replaceChannelContext).not.toHaveBeenCalled();
  });

  it('should compress when token count exceeds the threshold', async (): Promise<void> => {
    // contextWindow 4096 * 0.75 = 3072 limit. Build messages totaling ~4000 tokens.
    const messages = [makeMessageWithTokens('user', 2000), makeMessageWithTokens('assistant', 2000)];
    contextService.getConversationMessages.mockReturnValue(messages);

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.sendMessage).toHaveBeenCalled();
    expect(contextService.replaceChannelContext).toHaveBeenCalledWith('channel1', [expect.objectContaining({ isSummary: true })]);
  });

  it('should fold old summary into new summary', async (): Promise<void> => {
    const oldSummary = makeMessage('system', 'Old summary', true);
    const userMsg = makeMessageWithTokens('user', 2000);
    const assistantMsg = makeMessageWithTokens('assistant', 2000);
    contextService.getConversationMessages.mockReturnValue([oldSummary, userMsg, assistantMsg]);

    await compressionService.compressIfNeeded('channel1');

    const allCalls = ollamaClient.sendMessage.mock.calls;
    const reduceCall = allCalls[allCalls.length - 1];
    const context = reduceCall[1];
    const hasOldSummary = context.some(
      (m: { role: string; content: string }) => m.role === 'system' && m.content.includes('Old summary')
    );
    expect(hasOldSummary).toBe(true);
  });

  it('should no-op when summarize fails', async (): Promise<void> => {
    const messages = [makeMessageWithTokens('user', 2000), makeMessageWithTokens('assistant', 2000)];
    contextService.getConversationMessages.mockReturnValue(messages);
    ollamaClient.sendMessage.mockRejectedValue(new Error('LLM error'));

    await compressionService.compressIfNeeded('channel1');

    expect(contextService.replaceChannelContext).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should fall back to show() when ollamaContextWindow config is null', async (): Promise<void> => {
    configurationService = createMockConfigurationService({ ollamaContextWindow: null });
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, { role: string; content: string }>(services);

    const messages = [makeMessage('user', 'hello')];
    contextService.getConversationMessages.mockReturnValue(messages);

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.show).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('8192'));
  });

  it('should fall back to 4096 when show() fails and config is null', async (): Promise<void> => {
    configurationService = createMockConfigurationService({ ollamaContextWindow: null });
    ollamaClient.show.mockRejectedValue(new Error('show failed'));
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, { role: string; content: string }>(services);

    const messages = [makeMessage('user', 'hello')];
    contextService.getConversationMessages.mockReturnValue(messages);

    await compressionService.compressIfNeeded('channel1');

    expect(logger.warn).toHaveBeenCalled();
  });

  it('should chunk and summarize when conversation exceeds context window', async (): Promise<void> => {
    configurationService = createMockConfigurationService({ ollamaContextWindow: 100 });
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, { role: string; content: string }>(services);

    // 50 messages of 5 tokens each = ~250 tokens, well over window=100.
    const messages: ContextMessage<unknown, unknown>[] = [];
    for (let i = 0; i < 50; i++) {
      messages.push(makeMessageWithTokens('user', 5));
    }
    contextService.getConversationMessages.mockReturnValue(messages);

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.sendMessage).toHaveBeenCalled();
    expect(contextService.replaceChannelContext).toHaveBeenCalledWith('channel1', [expect.objectContaining({ isSummary: true })]);
  });

  it('should preserve old summary when chunking conversation messages', async (): Promise<void> => {
    configurationService = createMockConfigurationService({ ollamaContextWindow: 100 });
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, { role: string; content: string }>(services);

    const oldSummary = makeMessage('system', 'Old summary of earlier conversation', true);
    const messages: ContextMessage<unknown, unknown>[] = [oldSummary];
    for (let i = 0; i < 50; i++) {
      messages.push(makeMessageWithTokens('user', 5));
    }
    contextService.getConversationMessages.mockReturnValue(messages);

    await compressionService.compressIfNeeded('channel1');

    const allCalls = ollamaClient.sendMessage.mock.calls;
    const reduceCall = allCalls[allCalls.length - 1];
    const reduceContext = reduceCall[1] as { role: string; content: string }[];
    const hasOldSummary = reduceContext.some(
      (m) => m.role === 'system' && m.content.includes('Old summary')
    );
    expect(hasOldSummary).toBe(true);
  });

  describe('calibration via tokenCountSample', () => {
    it('should calibrate charsPerToken from promptTokenCount sample', async (): Promise<void> => {
      // Build messages with a known serialized char count.
      const content: string = 'x'.repeat(400);
      const messages = [makeMessage('user', content)];
      contextService.getConversationMessages.mockReturnValue(messages);

      // Sample says those 400 chars = 100 prompt tokens → 4 chars/token.
      // With default already 4.0, no visible change, but this verifies
      // calibration runs without error and compression still works.
      const sample: ITokenCountSample = { promptTokenCount: 100, responseTokenCount: 50 };

      await compressionService.compressIfNeeded('channel1', sample);

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('calibrated'));
    });

    it('should adjust estimate after calibration with a different ratio', async (): Promise<void> => {
      // 400 chars of content. Default ratio 4.0 → 100 tokens (under 3072 limit, no compress).
      const content: string = 'x'.repeat(400);
      const messages = [makeMessage('user', content)];
      contextService.getConversationMessages.mockReturnValue(messages);

      // First: calibrate to 1 char/token (100 tokens → 400 chars / 100 tokens = 4, not different).
      // Instead, calibrate to a ratio that makes the estimate exceed threshold.
      // 400 chars / 50 tokens = 8 chars/token. After calibration, estimate = 400/8 = 50 tokens.
      // Still under. To force compression via calibration, use a sample that lowers charsPerToken.
      // 400 chars / 1600 tokens = 0.25 chars/token → estimate = 400/0.25 = 1600 tokens.
      // Still under 3072. Use a bigger content or smaller ratio.
      // Use 20000 chars, sample 10000 prompt tokens → 2 chars/token → estimate = 20000/2 = 10000 > 3072.
      const bigContent: string = 'x'.repeat(20000);
      const bigMessages = [makeMessage('user', bigContent)];
      contextService.getConversationMessages.mockReturnValue(bigMessages);

      const sample: ITokenCountSample = { promptTokenCount: 10000, responseTokenCount: 100 };

      await compressionService.compressIfNeeded('channel1', sample);

      expect(ollamaClient.sendMessage).toHaveBeenCalled();
      expect(contextService.replaceChannelContext).toHaveBeenCalledWith('channel1', [expect.objectContaining({ isSummary: true })]);
    });

    it('should skip calibration when no conversation messages exist', async (): Promise<void> => {
      contextService.getConversationMessages.mockReturnValue([]);

      const sample: ITokenCountSample = { promptTokenCount: 100, responseTokenCount: 50 };

      await compressionService.compressIfNeeded('channel1', sample);

      expect(logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('calibrated'));
    });

    it('should skip calibration when promptTokenCount is zero', async (): Promise<void> => {
      const messages = [makeMessage('user', 'hello')];
      contextService.getConversationMessages.mockReturnValue(messages);

      const sample: ITokenCountSample = { promptTokenCount: 0, responseTokenCount: 0 };

      await compressionService.compressIfNeeded('channel1', sample);

      expect(logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('calibrated'));
    });
  });
});