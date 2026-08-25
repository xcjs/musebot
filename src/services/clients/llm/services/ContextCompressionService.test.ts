import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { ILogger } from '../../../ILogger.js';
import { ContextMessage } from '../ollama/models/ContextMessage.js';
import { OllamaClient } from '../ollama/OllamaClient.js';
import { ContextCompressionService } from './ContextCompressionService.js';
import { IContextCompressionService } from './IContextCompressionService.js';
import { IContextMessageFactory } from './IContextMessageFactory.js';
import { IContextService } from './IContextService.js';

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

function makeTokens(count: number): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < count; i++) {
    tokens.push('tok');
  }
  return tokens;
}

function mockFetchTokens(tokens: string[]): typeof fetch {
  const tokensCopy: string[] = [...tokens];
  return jest.fn<() => Promise<unknown>>().mockResolvedValue({
    ok: true,
    json: (): Promise<{ tokens: string[] }> => Promise.resolve({ tokens: tokensCopy })
  }) as unknown as typeof fetch;
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
    const messages = [makeMessage('user', 'hello'), makeMessage('assistant', 'hi')];
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = mockFetchTokens(makeTokens(10));

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.sendMessage).not.toHaveBeenCalled();
    expect(contextService.replaceChannelContext).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });

  it('should compress when token count exceeds the threshold', async (): Promise<void> => {
    const messages = [makeMessage('user', 'hello'), makeMessage('assistant', 'hi')];
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = mockFetchTokens(makeTokens(5000));

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.sendMessage).toHaveBeenCalled();
    expect(contextService.replaceChannelContext).toHaveBeenCalledWith('channel1', [expect.objectContaining({ isSummary: true })]);

    global.fetch = originalFetch;
  });

  it('should fold old summary into new summary', async (): Promise<void> => {
    const oldSummary = makeMessage('system', 'Old summary', true);
    const userMsg = makeMessage('user', 'hello');
    const assistantMsg = makeMessage('assistant', 'hi');
    contextService.getConversationMessages.mockReturnValue([oldSummary, userMsg, assistantMsg]);

    const originalFetch = global.fetch;
    global.fetch = mockFetchTokens(makeTokens(5000));

    await compressionService.compressIfNeeded('channel1');

    const allCalls = ollamaClient.sendMessage.mock.calls;
    const reduceCall = allCalls[allCalls.length - 1];
    const context = reduceCall[1];
    const hasOldSummary = context.some(
      (m: { role: string; content: string }) => m.role === 'system' && m.content.includes('Old summary')
    );
    expect(hasOldSummary).toBe(true);

    global.fetch = originalFetch;
  });

  it('should no-op when tokenize fails', async (): Promise<void> => {
    const messages = [makeMessage('user', 'hello'), makeMessage('assistant', 'hi')];
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = jest.fn<() => Promise<unknown>>().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.sendMessage).not.toHaveBeenCalled();
    expect(contextService.replaceChannelContext).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();

    global.fetch = originalFetch;
  });

  it('should no-op when summarize fails', async (): Promise<void> => {
    const messages = [makeMessage('user', 'hello'), makeMessage('assistant', 'hi')];
    contextService.getConversationMessages.mockReturnValue(messages);
    ollamaClient.sendMessage.mockRejectedValue(new Error('LLM error'));

    const originalFetch = global.fetch;
    global.fetch = mockFetchTokens(makeTokens(5000));

    await compressionService.compressIfNeeded('channel1');

    expect(contextService.replaceChannelContext).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();

    global.fetch = originalFetch;
  });

  it('should fall back to show() when ollamaContextWindow config is null', async (): Promise<void> => {
    configurationService = createMockConfigurationService({ ollamaContextWindow: null });
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, { role: string; content: string }>(services);

    const messages = [makeMessage('user', 'hello')];
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = mockFetchTokens(makeTokens(10));

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.show).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('8192'));

    global.fetch = originalFetch;
  });

  it('should fall back to 4096 when show() fails and config is null', async (): Promise<void> => {
    configurationService = createMockConfigurationService({ ollamaContextWindow: null });
    ollamaClient.show.mockRejectedValue(new Error('show failed'));
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, { role: string; content: string }>(services);

    const messages = [makeMessage('user', 'hello')];
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = mockFetchTokens(makeTokens(10));

    await compressionService.compressIfNeeded('channel1');

    expect(logger.warn).toHaveBeenCalled();

    global.fetch = originalFetch;
  });

  it('should chunk and summarize when conversation exceeds context window', async (): Promise<void> => {
    configurationService = createMockConfigurationService({ ollamaContextWindow: 100 });
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, { role: string; content: string }>(services);

    const messages: ContextMessage<unknown, unknown>[] = [];
    for (let i = 0; i < 50; i++) {
      messages.push(makeMessage('user', `Message ${i} with some content to make it longer`));
    }
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = mockFetchTokens(makeTokens(200));

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.sendMessage).toHaveBeenCalled();
    expect(contextService.replaceChannelContext).toHaveBeenCalledWith('channel1', [expect.objectContaining({ isSummary: true })]);

    global.fetch = originalFetch;
  });

  it('should preserve old summary when chunking conversation messages', async (): Promise<void> => {
    configurationService = createMockConfigurationService({ ollamaContextWindow: 100 });
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, { role: string; content: string }>(services);

    const oldSummary = makeMessage('system', 'Old summary of earlier conversation', true);
    const messages: ContextMessage<unknown, unknown>[] = [oldSummary];
    for (let i = 0; i < 50; i++) {
      messages.push(makeMessage('user', `Message ${i} with some content`));
    }
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = mockFetchTokens(makeTokens(500));

    await compressionService.compressIfNeeded('channel1');

    const allCalls = ollamaClient.sendMessage.mock.calls;
    const reduceCall = allCalls[allCalls.length - 1];
    const reduceContext = reduceCall[1] as { role: string; content: string }[];
    const hasOldSummary = reduceContext.some(
      (m) => m.role === 'system' && m.content.includes('Old summary')
    );
    expect(hasOldSummary).toBe(true);

    global.fetch = originalFetch;
  });
});