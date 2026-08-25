import { Message as OllamaMessage } from 'ollama';

import { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { ILogger } from '../../../ILogger.js';
import { OllamaRole } from '../ollama/enums/OllamaRole.js';
import { ContextMessage } from '../ollama/models/ContextMessage.js';
import { OllamaClient } from '../ollama/OllamaClient.js';
import { IContextCompressionService } from './IContextCompressionService.js';
import { IContextMessageFactory } from './IContextMessageFactory.js';
import { IContextService } from './IContextService.js';

const SUMMARIZATION_SYSTEM_PROMPT: string =
  'You are a conversation summarizer. Summarize the following conversation concisely, '
  + 'preserving key facts, decisions, context, and the flow of discussion. '
  + 'Write your summary as a coherent narrative that captures the essential information. '
  + 'Do not add any commentary — output only the summary.';

const FALLBACK_CONTEXT_WINDOW: number = 4096;

export class ContextCompressionService<ChatMessageType, LlmMessageType extends { role: string; content: string }> implements IContextCompressionService {
  readonly #services: IBotServiceContainer;
  readonly #logger: ILogger;

  constructor(services: IBotServiceContainer) {
    this.#services = services;
    this.#logger = services.getLogger('ContextCompressionService');
  }

  async compressIfNeeded(channelId: string): Promise<void> {
    try {
      const contextWindow: number = await this.#resolveContextWindow();
      const threshold: number = this.#configurationService.ollamaContextCompressionThreshold;
      const limit: number = Math.floor(contextWindow * threshold);

      const messages: ContextMessage<ChatMessageType, LlmMessageType>[] =
        this.#contextService.getConversationMessages(channelId);

      if (messages.length === 0) {
        return;
      }

      const text: string = messages
        .map((message) => `${message.llmMessage.role}: ${message.llmMessage.content}`)
        .join('\n');
      const tokenCount: number = await this.#tokenize(text);

      this.#logger.info(`Channel ${channelId}: ${tokenCount} tokens / ${limit} limit (window ${contextWindow}, threshold ${threshold}).`);

      if (tokenCount <= limit) {
        return;
      }

      await this.#summarizeAndReplace(channelId);
    } catch (error) {
      this.#logger.error(`Failed to check/compress context for channel ${channelId}:`, error);
    }
  }

  async #summarizeAndReplace(channelId: string): Promise<void> {
    const messages: ContextMessage<ChatMessageType, LlmMessageType>[] =
      this.#contextService.getConversationMessages(channelId);

    if (messages.length === 0) {
      return;
    }

    const conversationMessages: ContextMessage<ChatMessageType, LlmMessageType>[] = [];
    const summaryMessages: ContextMessage<ChatMessageType, LlmMessageType>[] = [];

    for (const message of messages) {
      if (message.isSummary) {
        summaryMessages.push(message);
      } else {
        conversationMessages.push(message);
      }
    }

    const systemPrompt: OllamaMessage = { role: OllamaRole.System, content: SUMMARIZATION_SYSTEM_PROMPT };

    const oldSummaryContext: OllamaMessage[] = summaryMessages.map((summary) => ({
      role: OllamaRole.System,
      content: `Previous summary of earlier conversation:\n${summary.llmMessage.content}`
    }));

    const conversationContext: OllamaMessage[] = conversationMessages.map((message) => ({
      role: message.llmMessage.role,
      content: message.llmMessage.content
    }));

    const fullContext: OllamaMessage[] = [systemPrompt, ...oldSummaryContext, ...conversationContext];
    const contextWindow: number = await this.#resolveContextWindow();
    const fullTokenCount: number = await this.#tokenize(this.#serializeOllamaMessages(fullContext));

    let summaryText: string;

    if (fullTokenCount <= contextWindow) {
      summaryText = await this.#generateSummary(fullContext);
    } else {
      summaryText = await this.#summarizeInChunks(systemPrompt, oldSummaryContext, conversationContext, contextWindow);
    }

    const summaryMessage: ContextMessage<ChatMessageType, LlmMessageType> =
      this.#contextMessageFactory.fromSummary(summaryText, channelId);

    this.#contextService.replaceChannelContext(channelId, [summaryMessage]);

    this.#logger.info(`Compressed ${messages.length} message(s) into 1 summary for channel ${channelId}.`);
  }

  async #summarizeInChunks(
    systemPrompt: OllamaMessage,
    oldSummaryContext: OllamaMessage[],
    conversationContext: OllamaMessage[],
    contextWindow: number
  ): Promise<string> {
    const systemPromptTokens: number = await this.#tokenize(this.#serializeOllamaMessages([systemPrompt]));
    const chunkCapacity: number = contextWindow - systemPromptTokens;

    this.#logger.info(`Conversation exceeds context window (${contextWindow}); chunking into segments for individual summarization.`);

    const chunks: OllamaMessage[][] = await this.#splitIntoChunks(conversationContext, chunkCapacity);

    const chunkSummaries: OllamaMessage[] = [];
    for (const chunk of chunks) {
      const chunkContext: OllamaMessage[] = [systemPrompt, ...chunk];
      const chunkSummary: string = await this.#generateSummary(chunkContext);
      chunkSummaries.push({
        role: OllamaRole.System,
        content: `Summary of conversation segment:\n${chunkSummary}`
      });
    }

    const reduceContext: OllamaMessage[] = [systemPrompt, ...oldSummaryContext, ...chunkSummaries];
    const reduceTokenCount: number = await this.#tokenize(this.#serializeOllamaMessages(reduceContext));

    if (reduceTokenCount <= contextWindow) {
      return this.#generateSummary(reduceContext);
    }

    this.#logger.info(`Combined summaries exceed context window; dropping oldest segment summaries to fit.`);

    let trimmedReduce: OllamaMessage[] = [...reduceContext];
    let trimmedTokens: number = reduceTokenCount;
    const firstChunkSummaryIndex: number = 1 + oldSummaryContext.length;

    while (trimmedTokens > contextWindow && trimmedReduce.length > firstChunkSummaryIndex) {
      trimmedReduce = trimmedReduce.filter((_, idx) => idx !== firstChunkSummaryIndex);
      trimmedTokens = await this.#tokenize(this.#serializeOllamaMessages(trimmedReduce));
    }

    return this.#generateSummary(trimmedReduce);
  }

  async #splitIntoChunks(messages: OllamaMessage[], capacity: number): Promise<OllamaMessage[][]> {
    if (messages.length === 0) {
      return [];
    }

    const chunks: OllamaMessage[][] = [];
    let currentChunk: OllamaMessage[] = [];
    let currentTokens: number = 0;

    for (const message of messages) {
      const messageTokens: number = await this.#tokenize(this.#serializeOllamaMessages([message]));

      if (currentTokens + messageTokens > capacity && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentTokens = 0;
      }

      currentChunk.push(message);
      currentTokens += messageTokens;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  async #generateSummary(context: OllamaMessage[]): Promise<string> {
    const ollamaClient: OllamaClient = this.#services.ollamaClient;
    const exchange = await ollamaClient.sendMessage('Summarize the conversation above.', context);
    return exchange.exchange.response.message.content;
  }

  async #tokenize(text: string): Promise<number> {
    const configurationService: IConfigurationService = this.#configurationService;
    const host: URL = configurationService.ollamaHosts[0];
    const model: string = this.#services.ollamaClient.model;

    const response: Response = await fetch(`${host.origin}/api/tokenize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model, text: text })
    });

    if (!response.ok) {
      throw new Error(`Tokenize request failed: ${response.status} ${response.statusText}`);
    }

    const body: { tokens: string[] } = await response.json() as { tokens: string[] };
    return body.tokens.length;
  }

  #serializeOllamaMessages(messages: OllamaMessage[]): string {
    return messages
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n');
  }

  async #resolveContextWindow(): Promise<number> {
    const configWindow: number | null = this.#configurationService.ollamaContextWindow;

    if (configWindow !== null) {
      return configWindow;
    }

    try {
      const showResponse = await this.#services.ollamaClient.show();
      const modelInfo: Map<string, unknown> = showResponse.model_info;

      for (const [key, value] of modelInfo) {
        if (key.endsWith('.context_length')) {
          return value as number;
        }
      }

      this.#logger.warn(`No *.context_length key found in model_info; falling back to ${FALLBACK_CONTEXT_WINDOW}.`);
      return FALLBACK_CONTEXT_WINDOW;
    } catch (error) {
      this.#logger.warn(`Failed to query show() for context window; falling back to ${FALLBACK_CONTEXT_WINDOW}:`, error);
      return FALLBACK_CONTEXT_WINDOW;
    }
  }

  get #contextService(): IContextService<ChatMessageType, LlmMessageType> {
    return this.#services.getContextService<ChatMessageType, LlmMessageType>();
  }

  get #contextMessageFactory(): IContextMessageFactory<ChatMessageType, LlmMessageType> {
    return this.#services.getContextMessageFactory<ChatMessageType, LlmMessageType>();
  }

  get #configurationService(): IConfigurationService {
    return this.#services.configurationService;
  }
}