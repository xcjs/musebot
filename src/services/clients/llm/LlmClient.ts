import { IHttpExchange } from '../../../models/IHttpExchange.js';
import { IHttpExchangeWithAttachedData } from '../../../models/IHttpExchangeWithAttachedData.js';
import { getRandomArrayEntry, getRandomInt } from '../../../utilities/random-utilities.js';
import { trimTrailingJsonContent } from '../../../utilities/string-utilities.js';
import { IConfigurationService } from '../../environment-settings/IConfigurationService.js';
import { IBotServiceContainer } from '../../IBotServiceContainer.js';
import { ILogger } from '../../ILogger.js';
import { LlmHostFlavor } from './enums/LlmHostFlavor.js';
import { LlmModality } from './enums/LlmModality.js';
import { LlmRole } from './enums/LlmRole.js';
import { ILlmClient } from './ILlmClient.js';
import { ILlmLifecycleStrategy } from './lifecycle/ILlmLifecycleStrategy.js';
import { LlamaCppRouterLifecycleStrategy } from './lifecycle/LlamaCppRouterLifecycleStrategy.js';
import { LlamaCppSingleLifecycleStrategy } from './lifecycle/LlamaCppSingleLifecycleStrategy.js';
import { NullLifecycleStrategy } from './lifecycle/NullLifecycleStrategy.js';
import { OllamaLifecycleStrategy } from './lifecycle/OllamaLifecycleStrategy.js';
import { ILlmEmbeddingsRequest } from './models/ILlmEmbeddingsRequest.js';
import { ILlmHost } from './models/ILlmHost.js';
import { ILlmRequest } from './models/ILlmRequest.js';
import { ILlmShowRequest } from './models/ILlmShowRequest.js';
import { IStructuredRequestData } from './models/IStructuredRequestData.js';
import { LlmChatCompletionResponse } from './models/LlmChatCompletionResponse.js';
import { LlmChatResult } from './models/LlmChatResult.js';
import { LlmEmbeddingsResponse } from './models/LlmEmbeddingsResponse.js';
import { LlmGenerateResult } from './models/LlmGenerateResult.js';
import { LlmImageContentPart } from './models/LlmImageContentPart.js';
import { LlmMessage } from './models/LlmMessage.js';
import { LlmShowResponse } from './models/LlmShowResponse.js';
import { LlmStreamChunk } from './models/LlmStreamChunk.js';
import { LlmStreamChunkResponse } from './models/LlmStreamChunkResponse.js';
import { LlmTextContentPart } from './models/LlmTextContentPart.js';
import { LlmWireChatCompletionRequest } from './models/LlmWireChatCompletionRequest.js';
import { LlmWireMessage } from './models/LlmWireMessage.js';

export class LlmClient implements ILlmClient {
  readonly #configurationService: IConfigurationService;
  readonly #logger: ILogger;

  readonly #host: ILlmHost;
  readonly #model: string;
  readonly #lifecycleStrategy: ILlmLifecycleStrategy;

  get host(): URL {
    return this.#host.url;
  }

  get model(): string {
    return this.#model;
  }

  constructor(services: IBotServiceContainer) {
    this.#configurationService = services.configurationService;

    this.#logger = services.getLogger('LlmClient');

    const host = getRandomArrayEntry(this.#configurationService.llmHosts);

    if (!host) {
      throw new Error('No LLM hosts configured in environment settings.');
    }

    this.#host = host;
    this.#logger.info(`Selected host: ${host.url}`);

    this.#model = this.#selectModel(this.#configurationService.llmModels);

    this.#lifecycleStrategy = this.#selectStrategy(services, host);
  }

  async generate(prompt: string, temperature: number | undefined = undefined): Promise<IHttpExchange<ILlmRequest, LlmGenerateResult>> {
    const request: ILlmRequest = this.#buildChatRequest([{ role: LlmRole.User, content: prompt }], temperature);

    this.#logger.info(`Calling the LLM API with the prompt: ${prompt}`);

    try {
      const body = await this.#postChat(request);
      return { request, response: this.#toGenerateResult(body) };
    } catch (error) {
      this.#logger.error('Failed to generate a response from the LLM:', error);
      throw new Error('Failed to generate a response from the LLM.', { cause: error });
    }
  }

  async generateStructured<TOutput>(prompt: string, requestData: IStructuredRequestData):
    Promise<IHttpExchangeWithAttachedData<ILlmRequest, LlmGenerateResult, TOutput>>
  {
    const messages: LlmMessage[] = [
      { role: LlmRole.System, content: requestData.systemPrompt },
      { role: LlmRole.User, content: prompt }
    ];

    const request: ILlmRequest = {
      ...this.#buildChatRequest(messages),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'result',
          schema: requestData.schema
        }
      }
    };

    this.#logger.info(`Calling the LLM API with the prompt: ${prompt}`);

    try {
      const body = await this.#postChat({ ...request, stream: false });

      const rawContent = body.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(trimTrailingJsonContent(rawContent)) as TOutput;

      return {
        exchange: {
          request,
          response: this.#toGenerateResult(body)
        },
        data: parsed
      };
    } catch (error) {
      this.#logger.error('Failed to send the LLM a structured request:', error);
      throw new Error('Failed to send the LLM a structured request.', { cause: error });
    }
  }

  async sendMessage(prompt: string, context: LlmMessage[], images: string[] = []):
    Promise<IHttpExchangeWithAttachedData<ILlmRequest, LlmChatResult, LlmMessage[]>>
  {
    const userMessage = this.#buildUserMessage(prompt, images);
    const messages = [...context, userMessage];

    const request = this.#buildChatRequest(messages);

    this.#logger.info('Calling the LLM API with the prompt:', prompt);

    if (context.length > 0) {
      this.#logger.info(`A context of ${context.length} message(s) is provided.`);
    }

    if (images.length > 0) {
      this.#logger.info(`Attaching ${images.length} image(s) to the LLM request.`);
    }

    try {
      const body = await this.#postChat({ ...request, stream: false });

      const assistantMessage: LlmMessage = {
        role: LlmRole.Assistant,
        content: body.choices?.[0]?.message?.content ?? ''
      };
      context.push(assistantMessage);

      return {
        exchange: {
          request,
          response: this.#toChatResult(body)
        },
        data: context
      };
    } catch (error) {
      this.#logger.error('Failed to send the LLM a message:', error);
      throw new Error('Failed to send the LLM a message.', { cause: error });
    }
  }

  async sendMessageAndGetStream(prompt: string, context: LlmMessage[], images: string[] = []):
    Promise<IHttpExchangeWithAttachedData<ILlmRequest, AsyncIterable<LlmStreamChunk>, LlmMessage[]> | null>
  {
    const userMessage = this.#buildUserMessage(prompt, images);
    const messages = [...context, userMessage];

    const request: ILlmRequest = {
      ...this.#buildChatRequest(messages),
      stream: true,
      stream_options: { include_usage: true }
    };

    this.#logger.info(`Calling the LLM API with the prompt: ${prompt}`);

    if (context.length > 0) {
      this.#logger.info(`A context of ${context.length} message(s) is provided.`);
    }

    if (images.length > 0) {
      this.#logger.info(`Attaching ${images.length} image(s) to the LLM request.`);
    }

    try {
      const path = '/chat/completions';
      const response = await this.#fetchResponse(path, this.#toWireRequest(request));

      if (!response.ok) {
        throw new Error(`The LLM API at ${this.#endpointBase}${path} responded with status ${response.status}.`);
      }

      if (response.body === null) {
        return null;
      }

      return {
        exchange: {
          request,
          response: this.#streamChunks(response.body.getReader())
        },
        data: context
      };
    } catch (error) {
      this.#logger.error('An error occurred while sending the LLM a message and retrieving a stream:', error);
      throw new Error('Failed to send the LLM a message and retrieve a stream.', { cause: error });
    }
  }

  async embed(input: string): Promise<number[]> {
    const embeddingModel = this.#configurationService.llmEmbeddingModel;

    if (!embeddingModel) {
      throw new Error('No embedding model configured.');
    }

    const request: ILlmEmbeddingsRequest = { model: embeddingModel, input };

    try {
      const body = await this.#postJson<LlmEmbeddingsResponse>('/embeddings', request);
      return this.#toEmbeddings(body)[0] ?? [];
    } catch (error) {
      this.#logger.error('Failed to request embeddings from the LLM:', error);
      throw new Error('Failed to request embeddings from the LLM.', { cause: error });
    }
  }

  async embedBatch(inputs: string[]): Promise<number[][]> {
    if (inputs.length === 0) {
      return [];
    }

    const embeddingModel = this.#configurationService.llmEmbeddingModel;

    if (!embeddingModel) {
      throw new Error('No embedding model configured.');
    }

    const request: ILlmEmbeddingsRequest = { model: embeddingModel, input: inputs };

    try {
      const body = await this.#postJson<LlmEmbeddingsResponse>('/embeddings', request);
      return this.#toEmbeddings(body);
    } catch (error) {
      this.#logger.error('Failed to request embeddings from the LLM:', error);
      throw new Error('Failed to request embeddings from the LLM.', { cause: error });
    }
  }

  async interpretImages(images: string[], contextPrompt: string = ''): Promise<string> {
    if (images.length === 0) {
      return '';
    }

    const prompt = 'You are a visual assistant. Describe what you see in the attached image(s)'
      + ' concisely and factually, as plain text. Focus on subjects, scene, colors, and any visible text.'
      + ' If multiple images are attached, describe each in order.'
      + (contextPrompt.length > 0 ? `\n\nContext for these images:\n${contextPrompt}` : '');

    const request: ILlmRequest = this.#buildChatRequest([this.#buildUserMessage(prompt, images)]);

    this.#logger.info(`Calling the LLM API to interpret ${images.length} image(s).`);

    try {
      const body = await this.#postChat(request);
      return (body.choices?.[0]?.message?.content ?? '').trim();
    } catch (error) {
      this.#logger.error('Failed to interpret image(s) via the LLM:', error);
      throw new Error('Failed to interpret image(s) via the LLM.', { cause: error });
    }
  }

  async free(): Promise<boolean> {
    return await this.#lifecycleStrategy.free();
  }

  async isModelLoaded(): Promise<boolean> {
    return await this.#lifecycleStrategy.isModelLoaded();
  }

  async waitForModelUnload(intervalMs?: number): Promise<boolean> {
    return await this.#lifecycleStrategy.waitForModelUnload(intervalMs);
  }

  async getContextWindow(): Promise<number | null> {
    return await this.#lifecycleStrategy.getContextWindow();
  }

  async hasVisionCapability(model: string = this.#model): Promise<boolean> {
    const declared = this.#configurationService.llmModelConfigs.find(config => config.name === model);

    if (declared !== undefined) {
      return declared.inputModalities.includes(LlmModality.Image);
    }

    return await this.#lifecycleStrategy.hasVisionCapability(model);
  }

  async show(model: string = this.#model): Promise<LlmShowResponse> {
    const request: ILlmShowRequest = { model };

    try {
      const showUrl = new URL('/api/show', this.#host.url);
      const response = await fetch(showUrl, {
        method: 'POST',
        headers: this.#headers(),
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`The LLM API at ${showUrl} responded with status ${response.status}.`);
      }

      return await response.json() as LlmShowResponse;
    } catch (error) {
      this.#logger.error(`Failed to query the LLM for model details for '${model}':`, error);
      throw new Error(`Failed to query the LLM for model details for '${model}'.`, { cause: error });
    }
  }

  async *#streamChunks(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<LlmStreamChunk> {
    const decoder = new TextDecoder();
    let buffer = '';
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let sawDoneFrame = false;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) {
            continue;
          }

          const payload = line.slice(5).trim();

          if (payload.length === 0) {
            continue;
          }

          if (payload === '[DONE]') {
            sawDoneFrame = true;
            yield { content: '', done: true, promptTokens, completionTokens };
            return;
          }

          try {
            const parsed = JSON.parse(payload) as LlmStreamChunkResponse;
            const content = parsed.choices?.[0]?.delta?.content ?? '';

            if (parsed.usage !== undefined) {
              promptTokens = parsed.usage.prompt_tokens;
              completionTokens = parsed.usage.completion_tokens;
            }

            if (content.length === 0) {
              continue;
            }

            yield { content, done: false, promptTokens, completionTokens };
          } catch (error) {
            this.#logger.warn('Failed to parse an SSE chunk from the LLM stream:', error);
          }
        }
      }
    }

    if (!sawDoneFrame) {
      yield { content: '', done: true, promptTokens, completionTokens };
    }
  }

  #toWireRequest(request: ILlmRequest): LlmWireChatCompletionRequest {
    return { ...request, messages: this.#toWireMessages(request.messages) };
  }

  #toWireMessages(messages: LlmMessage[]): LlmWireMessage[] {
    return messages.map((message): LlmWireMessage => {
      if (message.images !== undefined && message.images.length > 0) {
        return {
          role: message.role,
          content: this.#buildContentParts(message.content, message.images)
        };
      }

      return { role: message.role, content: message.content };
    });
  }

  #buildContentParts(prompt: string, images: string[]): Array<LlmTextContentPart | LlmImageContentPart> {
    const parts: Array<LlmTextContentPart | LlmImageContentPart> = [
      { type: 'text', text: prompt }
    ];

    for (const image of images) {
      parts.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } });
    }

    return parts;
  }

  async #postChat(request: ILlmRequest): Promise<LlmChatCompletionResponse> {
    return await this.#postJson<LlmChatCompletionResponse>('/chat/completions', this.#toWireRequest(request));
  }

  async #postJson<TResponse>(path: string, request: ILlmEmbeddingsRequest | LlmWireChatCompletionRequest): Promise<TResponse> {
    const response = await this.#fetchResponse(path, request);

    if (!response.ok) {
      throw new Error(`The LLM API at ${this.#endpointBase}${path} responded with status ${response.status}.`);
    }

    return await response.json() as TResponse;
  }

  async #fetchResponse(path: string, request: ILlmEmbeddingsRequest | LlmWireChatCompletionRequest | ILlmShowRequest): Promise<Response> {
    return await fetch(`${this.#endpointBase}${path}`, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify(request)
    });
  }

  get #endpointBase(): string {
    const href = this.#host.url.href;
    return href.endsWith('/') ? href.slice(0, -1) : href;
  }

  #headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.#host.token !== null) {
      headers['Authorization'] = `Bearer ${this.#host.token}`;
    }

    return headers;
  }

  #buildChatRequest(messages: LlmMessage[], temperature: number | undefined = undefined): ILlmRequest {
    const request: ILlmRequest = {
      model: this.#model,
      messages
    };

    if (temperature !== undefined) {
      request.temperature = temperature;
    }

    return request;
  }

  #buildUserMessage(prompt: string, images: string[]): LlmMessage {
    const message: LlmMessage = { role: LlmRole.User, content: prompt };

    if (images.length > 0) {
      message.images = images;
    }

    return message;
  }

  #toEmbeddings(body: LlmEmbeddingsResponse): number[][] {
    return (body.data ?? [])
      .slice()
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
      .map(entry => entry.embedding ?? []);
  }

  #toGenerateResult(body: LlmChatCompletionResponse): LlmGenerateResult {
    return {
      content: body.choices?.[0]?.message?.content ?? '',
      totalTokens: body.usage?.total_tokens,
      promptTokens: body.usage?.prompt_tokens,
      completionTokens: body.usage?.completion_tokens
    };
  }

  #toChatResult(body: LlmChatCompletionResponse): LlmChatResult {
    return {
      message: {
        role: LlmRole.Assistant,
        content: body.choices?.[0]?.message?.content ?? ''
      },
      totalTokens: body.usage?.total_tokens,
      promptTokens: body.usage?.prompt_tokens,
      completionTokens: body.usage?.completion_tokens
    };
  }

  #selectModel(models: Array<string>): string {
    const model = models[getRandomInt(0, models.length - 1)];

    this.#logger.info(`Selected model: ${model}`);

    return model;
  }

  #selectStrategy(services: IBotServiceContainer, host: ILlmHost): ILlmLifecycleStrategy {
    const classification = services.llmHostFlavorRegistry.resolve(host);

    if (classification.isLocal === false) {
      return new NullLifecycleStrategy(host, this.#model, this.#logger);
    }

    switch (classification.flavor) {
      case LlmHostFlavor.Ollama:
        return new OllamaLifecycleStrategy(
          host,
          this.#model,
          this.#logger,
          this.#configurationService.taskRetryDelayMilliseconds);
      case LlmHostFlavor.LlamaCppRouter:
        return new LlamaCppRouterLifecycleStrategy(host, this.#model, this.#logger);
      case LlmHostFlavor.LlamaCppSingle:
        return new LlamaCppSingleLifecycleStrategy(host, this.#model, this.#logger);
      default:
        return new NullLifecycleStrategy(host, this.#model, this.#logger);
    }
  }
}