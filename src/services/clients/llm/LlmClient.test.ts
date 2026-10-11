import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { BotMode } from '../../../enums/BotMode.js';
import { NodeEnvironment } from '../../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../../enums/TaskQueueStrategy.js';
import type { IConfigurationService } from '../../environment-settings/IConfigurationService.js';
import type { IBotServiceContainer } from '../../IBotServiceContainer.js';
import type { ILogger } from '../../ILogger.js';
import { LlmHostFlavor } from './enums/LlmHostFlavor.js';
import { LlmRole } from './enums/LlmRole.js';
import { ILlmClient } from './ILlmClient.js';
import { LlamaCppRouterLifecycleStrategy } from './lifecycle/LlamaCppRouterLifecycleStrategy.js';
import { LlamaCppSingleLifecycleStrategy } from './lifecycle/LlamaCppSingleLifecycleStrategy.js';
import { NullLifecycleStrategy } from './lifecycle/NullLifecycleStrategy.js';
import { OllamaLifecycleStrategy } from './lifecycle/OllamaLifecycleStrategy.js';
import { LlmClient } from './LlmClient.js';
import { IStructuredRequestData } from './models/IStructuredRequestData.js';
import { LlmMessage } from './models/LlmMessage.js';
import { LlmStreamChunk } from './models/LlmStreamChunk.js';
import { LlmWireChatCompletionRequest } from './models/LlmWireChatCompletionRequest.js';

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

function createMockConfigurationService(overrides: Partial<IConfigurationService> = {}): IConfigurationService {
  return {
    packageName: 'musebot',
    version: '9.6.0',
    nodeEnvironment: NodeEnvironment.Test,
    botId: 'bot-1',
    botFunction: BotMode.Chat,
    discordToken: 'token',
    discordChannels: [],
    discordChannelsDisallowed: [],
    botRequiresMention: false,
    botResponseRate: 100,
    botPrivateMessageUsers: [],
    errorMessage: 'error',
    maxTaskAttempts: 3,
    taskRetryDelayMilliseconds: 100,
    taskQueueStrategy: TaskQueueStrategy.Serial,
    taskQueueForceSerialAcrossHosts: false,
    comfyUiHosts: [],
    comfyUiTimeoutMinutes: 30,
    comfyUiGuidanceScaleInterval: 0.5,
    randomPrompts: [],
    llmHosts: [{ url: new URL('http://localhost:11434'), token: null, isLocal: true }],
    llmModels: ['test-model'],
    llmSystemPrompt: '',
    llmStreamsResponse: false,
    llmEmbeddingModel: 'embed-model',
    llmTopK: 5,
    llmContextWindow: null,
    llmContextCompressionThreshold: 0.75,
    llmVisionModels: [],
    applicationName: 'Musebot',
    isProduction: false,
    ...overrides,
  };
}

function createMockServices(
  configurationService: IConfigurationService,
  logger: jest.Mocked<ILogger>,
  resolveValue: { flavor: LlmHostFlavor; isLocal: boolean } = { flavor: LlmHostFlavor.Ollama, isLocal: true }
): IBotServiceContainer {
  return {
    configurationService,
    featureService: null as never,
    taskQueue: null as never,
    typingService: null as never,
    discordClient: null as never,
    generativeChatClient: null as never,
    helpService: null as never,
    workflowService: null as never,
    webContentService: null as never,
    parallelizationStrategy: null as never,
    llmHostFlavorRegistry: {
      resolve: jest.fn((): { flavor: LlmHostFlavor; isLocal: boolean } => resolveValue)
    } as never,
    getLogger: jest.fn(() => logger),
    getTaskChannelPostProcessor: () => null as never,
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

function mockJsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller): void {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });

  return new Response(stream, { status: 200 });
}

const visionPrompt = 'You are a visual assistant. Describe what you see in the attached image(s)'
  + ' concisely and factually, as plain text. Focus on subjects, scene, colors, and any visible text.'
  + ' If multiple images are attached, describe each in order.';

describe('LlmClient', (): void => {
  let mockLogger: jest.Mocked<ILogger>;
  let fetchMock: jest.Mock<typeof fetch>;
  let client: LlmClient;

  beforeEach((): void => {
    mockLogger = createMockLogger();
    fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  function makeClient(
    resolveValue: { flavor: LlmHostFlavor; isLocal: boolean } = { flavor: LlmHostFlavor.Ollama, isLocal: true },
    configurationOverrides: Partial<IConfigurationService> = {}
  ): LlmClient {
    const config = createMockConfigurationService(configurationOverrides);
    const services = createMockServices(config, mockLogger, resolveValue);
    return new LlmClient(services);
  }

  describe('constructor', (): void => {
    it('selects a random host and model and logs them', (): void => {
      client = makeClient();

      expect(client.host).toEqual(new URL('http://localhost:11434'));
      expect(client.model).toBe('test-model');
      expect(mockLogger.info).toHaveBeenCalledWith('Selected host: http://localhost:11434/');
      expect(mockLogger.info).toHaveBeenCalledWith('Selected model: test-model');
    });

    it('throws when no hosts are configured', (): void => {
      expect(() => makeClient({ flavor: LlmHostFlavor.Ollama, isLocal: true }, { llmHosts: [] }))
        .toThrow('No LLM hosts configured in environment settings.');
    });
  });

  describe('strategy selection', (): void => {
    it('routes ollama-flavor local hosts to OllamaLifecycleStrategy', async (): Promise<void> => {
      const ollamaSpy = jest.spyOn(OllamaLifecycleStrategy.prototype, 'isModelLoaded').mockResolvedValue(true);
      const nullSpy = jest.spyOn(NullLifecycleStrategy.prototype, 'isModelLoaded').mockResolvedValue(false);

      client = makeClient({ flavor: LlmHostFlavor.Ollama, isLocal: true });

      expect(await client.isModelLoaded()).toBe(true);
      expect(ollamaSpy).toHaveBeenCalledTimes(1);
      expect(nullSpy).not.toHaveBeenCalled();
    });

    it('routes non-local hosts to NullLifecycleStrategy regardless of flavor', async (): Promise<void> => {
      const ollamaSpy = jest.spyOn(OllamaLifecycleStrategy.prototype, 'free').mockResolvedValue(false);
      const nullSpy = jest.spyOn(NullLifecycleStrategy.prototype, 'free').mockResolvedValue(true);

      client = makeClient({ flavor: LlmHostFlavor.Ollama, isLocal: false });

      expect(await client.free()).toBe(true);
      expect(nullSpy).toHaveBeenCalledTimes(1);
      expect(ollamaSpy).not.toHaveBeenCalled();
    });

    it('routes llamacpp-router flavor to LlamaCppRouterLifecycleStrategy', async (): Promise<void> => {
      const routerSpy = jest.spyOn(LlamaCppRouterLifecycleStrategy.prototype, 'isModelLoaded').mockResolvedValue(true);
      const nullSpy = jest.spyOn(NullLifecycleStrategy.prototype, 'isModelLoaded').mockResolvedValue(false);

      client = makeClient({ flavor: LlmHostFlavor.LlamaCppRouter, isLocal: true });

      expect(await client.isModelLoaded()).toBe(true);
      expect(routerSpy).toHaveBeenCalledTimes(1);
      expect(nullSpy).not.toHaveBeenCalled();
    });

    it('routes llamacpp-single flavor to LlamaCppSingleLifecycleStrategy', async (): Promise<void> => {
      const singleSpy = jest.spyOn(LlamaCppSingleLifecycleStrategy.prototype, 'waitForModelUnload').mockResolvedValue(true);
      const nullSpy = jest.spyOn(NullLifecycleStrategy.prototype, 'waitForModelUnload').mockResolvedValue(false);

      client = makeClient({ flavor: LlmHostFlavor.LlamaCppSingle, isLocal: true });

      expect(await client.waitForModelUnload(10)).toBe(true);
      expect(singleSpy).toHaveBeenCalledWith(10);
      expect(nullSpy).not.toHaveBeenCalled();
    });

    it('routes generic flavor to NullLifecycleStrategy', async (): Promise<void> => {
      const nullSpy = jest.spyOn(NullLifecycleStrategy.prototype, 'free').mockResolvedValue(true);
      const ollamaSpy = jest.spyOn(OllamaLifecycleStrategy.prototype, 'free').mockResolvedValue(false);

      client = makeClient({ flavor: LlmHostFlavor.Generic, isLocal: true });

      expect(await client.free()).toBe(true);
      expect(nullSpy).toHaveBeenCalledTimes(1);
      expect(ollamaSpy).not.toHaveBeenCalled();
    });

    it('gives non-local hosts visionModels via the Null strategy', async (): Promise<void> => {
      const windowSpy = jest.spyOn(OllamaLifecycleStrategy.prototype, 'getContextWindow').mockResolvedValue(123);
      const visionSpy = jest.spyOn(NullLifecycleStrategy.prototype, 'hasVisionCapability').mockResolvedValue(false);

      client = makeClient({ flavor: LlmHostFlavor.Ollama, isLocal: false }, {
        llmVisionModels: ['vision-model']
      });

      await client.getContextWindow();
      expect(windowSpy).not.toHaveBeenCalled();

      await client.hasVisionCapability('vision-model');
      expect(visionSpy).toHaveBeenCalledWith('vision-model');
      expect(await client.hasVisionCapability('vision-model')).toBe(false);
    });
  });

  describe('generate()', (): void => {
    beforeEach((): void => {
      client = makeClient();
    });

    it('posts a single-user-message chat completion and maps the result', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({
        choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
      }));

      const exchange = await client.generate('Hi there', 0.7);

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url as string)).toBe('http://localhost:11434/v1/chat/completions');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
      expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hi there' }],
        temperature: 0.7
      });
      expect(exchange.request.messages).toEqual([{ role: 'user', content: 'Hi there' }]);
      expect(exchange.response.content).toBe('Hello!');
      expect(exchange.response.totalTokens).toBe(8);
      expect(exchange.response.promptTokens).toBe(5);
      expect(exchange.response.completionTokens).toBe(3);
    });

    it('omits temperature when not provided', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));

      await client.generate('Hi');

      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body as string) as LlmWireChatCompletionRequest;
      expect(body.temperature).toBeUndefined();
    });

    it('wraps fetch errors preserving .cause', async (): Promise<void> => {
      const cause = new Error('network down');
      fetchMock.mockRejectedValue(cause);

      await expect(client.generate('Hi')).rejects.toThrow('Failed to generate a response from the LLM.');
      await expect(client.generate('Hi')).rejects.toMatchObject({ cause });
    });
  });

  describe('Bearer token', (): void => {
    it('sends Authorization header only when the host token is non-null', async (): Promise<void> => {
      client = makeClient({ flavor: LlmHostFlavor.Generic, isLocal: false }, {
        llmHosts: [{ url: new URL('https://api.example.com'), token: 'secret-token', isLocal: false }]
      });

      fetchMock.mockResolvedValue(mockJsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));

      await client.generate('Hi');

      const [url, init] = fetchMock.mock.calls[0];
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
      expect(String(url as string)).toBe('https://api.example.com/v1/chat/completions');
    });

    it('omits Authorization header when token is null', async (): Promise<void> => {
      client = makeClient();

      fetchMock.mockResolvedValue(mockJsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));

      await client.generate('Hi');

      const [, init] = fetchMock.mock.calls[0];
      expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    });
  });

  describe('generateStructured()', (): void => {
    beforeEach((): void => {
      client = makeClient();
    });

    it('sends a leading system message and json_schema response_format, parses trimmed JSON', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({
        choices: [{ message: { role: 'assistant', content: '{"answer": 42} trailing junk' } }]
      }));

      const requestData: IStructuredRequestData = {
        systemPrompt: 'Always respond in JSON.',
        schema: { type: 'object', properties: { answer: { type: 'number' } } }
      };

      const result = await client.generateStructured<{ answer: number }>('What is the answer?', requestData);

      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body as string) as LlmWireChatCompletionRequest;
      expect(body.messages[0]).toEqual({ role: 'system', content: 'Always respond in JSON.' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'What is the answer?' });
      expect(body.response_format).toEqual({
        type: 'json_schema',
        json_schema: {
          name: 'result',
          schema: { type: 'object', properties: { answer: { type: 'number' } } }
        }
      });
      expect(result.data).toEqual({ answer: 42 });
      expect(result.exchange.response.content).toBe('{"answer": 42} trailing junk');
    });

    it('wraps parse failures preserving .cause', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({
        choices: [{ message: { role: 'assistant', content: 'not json at all' } }]
      }));

      const requestData: IStructuredRequestData = { systemPrompt: 'sys', schema: {} };

      await expect(client.generateStructured('prompt', requestData))
        .rejects.toThrow('Failed to send the LLM a structured request.');
    });
  });

  describe('sendMessage()', (): void => {
    beforeEach((): void => {
      client = makeClient();
    });

    it('appends the user message, pushes the assistant response into context, and returns both', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({
        choices: [{ message: { role: 'assistant', content: 'Hello to you!' } }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 }
      }));

      const context: LlmMessage[] = [
        { role: LlmRole.System, content: 'You are a helpful assistant.' },
        { role: LlmRole.User, content: 'Previous question' },
        { role: LlmRole.Assistant, content: 'Previous answer' }
      ];

      const result = await client.sendMessage('New question', context);

      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body as string) as LlmWireChatCompletionRequest;
      expect(body.messages).toHaveLength(4);
      expect(body.messages[3]).toEqual({ role: 'user', content: 'New question' });
      expect(body.stream).toBe(false);

      expect(context).toHaveLength(4);
      expect(context[3]).toEqual({ role: 'assistant', content: 'Hello to you!' });

      expect(result.data).toBe(context);
      expect(result.exchange.response.message.content).toBe('Hello to you!');
      expect(result.exchange.response.message.role).toBe(LlmRole.Assistant);
      expect(result.exchange.response.totalTokens).toBe(14);
    });

    it('attaches images as image_url content parts on the wire', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({
        choices: [{ message: { role: 'assistant', content: 'I see a cat.' } }]
      }));

      const context: LlmMessage[] = [];
      const result = await client.sendMessage('What is this?', context, ['aGVsbG8=']);

      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'test-model',
        stream: false,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,aGVsbG8=' } }
          ]
        }]
      });

      expect(result.data).toBe(context);
      expect(context[0]).toEqual({ role: 'assistant', content: 'I see a cat.' });
    });

    it('wraps fetch failures preserving .cause', async (): Promise<void> => {
      const cause = new Error('boom');
      fetchMock.mockRejectedValue(cause);
      const context: LlmMessage[] = [];

      await expect(client.sendMessage('Hi', context)).rejects.toMatchObject({ cause });
    });
  });

  describe('sendMessageAndGetStream()', (): void => {
    beforeEach((): void => {
      client = makeClient();
    });

    it('returns an AsyncIterable of LlmStreamChunk parsed from SSE with usage on the final chunk', async (): Promise<void> => {
      const sseBody = [
        'data: {"choices":[{"delta":{"role":"assistant","content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo!"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":""}}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\n',
        'data: [DONE]\n\n'
      ];
      fetchMock.mockResolvedValue(sseResponse(sseBody));

      const context: LlmMessage[] = [];
      const result = await client.sendMessageAndGetStream('Hi', context);

      expect(result).not.toBeNull();

      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body as string) as LlmWireChatCompletionRequest;
      expect(body.stream).toBe(true);
      expect(body.stream_options).toEqual({ include_usage: true });

      const chunks: LlmStreamChunk[] = [];
      for await (const chunk of (result as { exchange: { response: AsyncIterable<LlmStreamChunk> } }).exchange.response) {
        chunks.push(chunk);
      }

      expect(chunks.map(chunk => chunk.content)).toEqual(['Hel', 'lo!', '']);
      expect(chunks[chunks.length - 1].done).toBe(true);
      expect(chunks[chunks.length - 1].promptTokens).toBe(3);
      expect(chunks[chunks.length - 1].completionTokens).toBe(2);
      expect((result as { data: LlmMessage[] }).data).toBe(context);
    });

    it('handles chunks split across network reads', async (): Promise<void> => {
      const sseBody = [
        'data: {"choices":[{"delta":{"content":"par"}}]}\n\ndata: {"choices":[{"del',
        'ta":{"content":"tial"}}]}\n\ndata: [DONE]\n\n'
      ];
      fetchMock.mockResolvedValue(sseResponse(sseBody));

      const result = await client.sendMessageAndGetStream('Hi', []);

      const chunks: LlmStreamChunk[] = [];
      for await (const chunk of (result as { exchange: { response: AsyncIterable<LlmStreamChunk> } }).exchange.response) {
        chunks.push(chunk);
      }

      expect(chunks.map(chunk => chunk.content)).toEqual(['par', 'tial', '']);
      expect(chunks[chunks.length - 1].done).toBe(true);
    });

    it('rejects with the HTTP status error as .cause when the response is non-ok', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({ error: 'server exploded' }, 500));

      const rejection = await client.sendMessageAndGetStream('Hi', [])
        .catch((reason: unknown): Error => reason as Error);
      const error = rejection as Error;

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Failed to send the LLM a message and retrieve a stream.');
      expect(error.cause).toBeInstanceOf(Error);
      expect((error.cause as Error).message).toBe('The LLM API at http://localhost:11434//v1/chat/completions responded with status 500.');
    });

    it('yields a terminal done chunk with usage when the stream ends without [DONE]', async (): Promise<void> => {
      const sseBody = [
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo!"}}],"usage":{"prompt_tokens":7,"completion_tokens":4,"total_tokens":11}}\n\n'
      ];
      fetchMock.mockResolvedValue(sseResponse(sseBody));

      const result = await client.sendMessageAndGetStream('Hi', []);

      expect(result).not.toBeNull();

      const chunks: LlmStreamChunk[] = [];
      for await (const chunk of (result as { exchange: { response: AsyncIterable<LlmStreamChunk> } }).exchange.response) {
        chunks.push(chunk);
      }

      expect(chunks.map(chunk => chunk.content)).toEqual(['Hel', 'lo!', '']);
      expect(chunks[chunks.length - 1].done).toBe(true);
      expect(chunks[chunks.length - 1].promptTokens).toBe(7);
      expect(chunks[chunks.length - 1].completionTokens).toBe(4);
    });

    it('wraps fetch failures preserving .cause', async (): Promise<void> => {
      const cause = new Error('stream boom');
      fetchMock.mockRejectedValue(cause);

      await expect(client.sendMessageAndGetStream('Hi', []))
        .rejects.toThrow('Failed to send the LLM a message and retrieve a stream.');
      await expect(client.sendMessageAndGetStream('Hi', [])).rejects.toMatchObject({ cause });
    });
  });

  describe('embed() / embedBatch()', (): void => {
    beforeEach((): void => {
      client = makeClient();
    });

    it('embed() posts { model, input } to /v1/embeddings and returns data[0].embedding', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({
        data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }]
      }));

      const embedding = await client.embed('some text');

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url as string)).toBe('http://localhost:11434/v1/embeddings');
      expect(JSON.parse(init.body as string)).toEqual({ model: 'embed-model', input: 'some text' });
      expect(embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('throws when no embedding model is configured', async (): Promise<void> => {
      client = makeClient({ flavor: LlmHostFlavor.Ollama, isLocal: true }, { llmEmbeddingModel: null });

      await expect(client.embed('text')).rejects.toThrow('No embedding model configured.');
    });

    it('embedBatch() posts the input array and maps data[].embedding in input order', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({
        data: [
          { index: 1, embedding: [0.4, 0.5] },
          { index: 0, embedding: [0.1, 0.2] },
          { index: 2, embedding: [0.7] }
        ]
      }));

      const embeddings = await client.embedBatch(['a', 'b', 'c']);

      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body as string)).toEqual({ model: 'embed-model', input: ['a', 'b', 'c'] });
      expect(embeddings).toEqual([[0.1, 0.2], [0.4, 0.5], [0.7]]);
    });

    it('embedBatch() returns [] for empty input without a fetch', async (): Promise<void> => {
      const embeddings = await client.embedBatch([]);

      expect(embeddings).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('embedBatch() throws when no embedding model is configured', async (): Promise<void> => {
      client = makeClient({ flavor: LlmHostFlavor.Ollama, isLocal: true }, { llmEmbeddingModel: null });

      await expect(client.embedBatch(['a'])).rejects.toThrow('No embedding model configured.');
    });
  });

  describe('interpretImages()', (): void => {
    beforeEach((): void => {
      client = makeClient();
    });

    it('returns empty string when no images are provided', async (): Promise<void> => {
      const result = await client.interpretImages([]);

      expect(result).toBe('');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends the hardcoded vision prompt with image content parts', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({
        choices: [{ message: { role: 'assistant', content: '  A cat sitting on a mat.  ' } }]
      }));

      const result = await client.interpretImages(['img1', 'img2'], 'The bot generated this image.');

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url as string)).toBe('http://localhost:11434/v1/chat/completions');
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'test-model',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `${visionPrompt}\n\nContext for these images:\nThe bot generated this image.` },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,img1' } },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,img2' } }
          ]
        }]
      });
      expect(result).toBe('A cat sitting on a mat.');
    });

    it('omits the context paragraph when no context prompt is given', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({
        choices: [{ message: { role: 'assistant', content: 'A scene.' } }]
      }));

      await client.interpretImages(['img1']);

      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'test-model',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: visionPrompt },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,img1' } }
          ]
        }]
      });
    });

    it('wraps fetch failures preserving .cause', async (): Promise<void> => {
      const cause = new Error('vision boom');
      fetchMock.mockRejectedValue(cause);

      await expect(client.interpretImages(['img1'])).rejects.toThrow('Failed to interpret image(s) via the LLM.');
    });
  });

  describe('lifecycle delegation', (): void => {
    it('delegates free(), isModelLoaded(), waitForModelUnload(), getContextWindow(), and hasVisionCapability() to the strategy', async (): Promise<void> => {
      client = makeClient();

      const freeSpy = jest.spyOn(OllamaLifecycleStrategy.prototype, 'free').mockResolvedValue(true);
      const isModelLoadedSpy = jest.spyOn(OllamaLifecycleStrategy.prototype, 'isModelLoaded').mockResolvedValue(false);
      const waitForModelUnloadSpy = jest.spyOn(OllamaLifecycleStrategy.prototype, 'waitForModelUnload').mockResolvedValue(true);
      const getContextWindowSpy = jest.spyOn(OllamaLifecycleStrategy.prototype, 'getContextWindow').mockResolvedValue(4096);
      const hasVisionCapabilitySpy = jest.spyOn(OllamaLifecycleStrategy.prototype, 'hasVisionCapability').mockResolvedValue(true);

      const llmClient: ILlmClient = client;

      expect(await llmClient.free()).toBe(true);
      expect(freeSpy).toHaveBeenCalledTimes(1);

      expect(await llmClient.isModelLoaded()).toBe(false);
      expect(isModelLoadedSpy).toHaveBeenCalledTimes(1);

      expect(await llmClient.waitForModelUnload(250)).toBe(true);
      expect(waitForModelUnloadSpy).toHaveBeenCalledWith(250);

      expect(await llmClient.getContextWindow()).toBe(4096);
      expect(getContextWindowSpy).toHaveBeenCalledTimes(1);

      expect(await llmClient.hasVisionCapability('some-model')).toBe(true);
      expect(hasVisionCapabilitySpy).toHaveBeenCalledWith('some-model');
    });
  });

  describe('show()', (): void => {
    beforeEach((): void => {
      client = makeClient();
    });

    it('queries /api/show and maps the payload to LlmShowResponse', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({
        model_info: { 'gemma.context_length': 100000 },
        capabilities: ['vision']
      }));

      const result = await client.show();

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url as string)).toBe('http://localhost:11434/api/show');
      expect(JSON.parse(init.body as string)).toEqual({ model: 'test-model' });
      expect(result).toEqual({ model_info: { 'gemma.context_length': 100000 }, capabilities: ['vision'] });
    });

    it('passes the model argument through', async (): Promise<void> => {
      fetchMock.mockResolvedValue(mockJsonResponse({ capabilities: [] }));

      await client.show('other-model');

      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body as string)).toEqual({ model: 'other-model' });
    });

    it('wraps failures preserving .cause', async (): Promise<void> => {
      const cause = new Error('show boom');
      fetchMock.mockRejectedValue(cause);

      await expect(client.show()).rejects.toThrow('Failed to query the LLM for model details for \'test-model\'.');
      await expect(client.show()).rejects.toMatchObject({ cause });
    });
  });
});