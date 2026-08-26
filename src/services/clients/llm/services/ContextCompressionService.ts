import { Message as OllamaMessage } from 'ollama';

import { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { ILogger } from '../../../ILogger.js';
import { OllamaRole } from '../ollama/enums/OllamaRole.js';
import { ContextMessage } from '../ollama/models/ContextMessage.js';
import { OllamaClient } from '../ollama/OllamaClient.js';
import { IContextCompressionService, ITokenCountSample } from './IContextCompressionService.js';
import { IContextMessageFactory } from './IContextMessageFactory.js';
import { IContextService } from './IContextService.js';

const SUMMARIZATION_SYSTEM_PROMPT: string =
  'You are a conversation summarizer. Summarize the following conversation concisely, '
  + 'preserving key facts, decisions, context, and the flow of discussion. '
  + 'Write your summary as a coherent narrative that captures the essential information. '
  + 'Do not add any commentary — output only the summary.';

const FALLBACK_CONTEXT_WINDOW: number = 4096;

// Default chars-per-token ratio for English text on typical BPE tokenizers
// (Llama, Mistral, etc.). Used until the first prompt_eval_count sample
// arrives to calibrate the ratio against the actual model.
const DEFAULT_CHARS_PER_TOKEN: number = 4.0;

// Exponential moving average smoothing factor. Lower = slower to update.
// 0.3 lets a new sample move the ratio meaningfully without discarding
// history from prior requests.
const CALIBRATION_ALPHA: number = 0.3;

export class ContextCompressionService<ChatMessageType, LlmMessageType extends { role: string; content: string }> implements IContextCompressionService {
  readonly #services: IBotServiceContainer;
  readonly #logger: ILogger;

  #charsPerToken: number = DEFAULT_CHARS_PER_TOKEN;

  constructor(services: IBotServiceContainer) {
    this.#services = services;
    this.#logger = services.getLogger('ContextCompressionService');
  }

  async compressIfNeeded(channelId: string, tokenCountSample?: ITokenCountSample): Promise<void> {
    try {
      if (tokenCountSample !== undefined) {
        this.#calibrate(channelId, tokenCountSample);
      }

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
      const tokenCount: number = this.#estimateTokens(text);

      this.#logger.info(`Channel ${channelId}: ${tokenCount} tokens / ${limit} limit (window ${contextWindow}, threshold ${threshold}, ${this.#charsPerToken.toFixed(2)} chars/token).`);

      if (tokenCount <= limit) {
        return;
      }

      await this.#summarizeAndReplace(channelId);
    } catch (error) {
      this.#logger.error(`Failed to check/compress context for channel ${channelId}:`, error);
    }
  }

  #calibrate(channelId: string, sample: ITokenCountSample): void {
    if (!Number.isFinite(sample.promptTokenCount) || sample.promptTokenCount <= 0) {
      return;
    }

    const messages: ContextMessage<ChatMessageType, LlmMessageType>[] =
      this.#contextService.getConversationMessages(channelId);

    if (messages.length === 0) {
      return;
    }

    const serialized: string = messages
      .map((message) => `${message.llmMessage.role}: ${message.llmMessage.content}`)
      .join('\n');

    if (serialized.length === 0) {
      return;
    }

    const observedCharsPerToken: number = serialized.length / sample.promptTokenCount;

    if (!Number.isFinite(observedCharsPerToken) || observedCharsPerToken <= 0) {
      return;
    }

    if (this.#charsPerToken === DEFAULT_CHARS_PER_TOKEN) {
      this.#charsPerToken = observedCharsPerToken;
    } else {
      this.#charsPerToken = (CALIBRATION_ALPHA * observedCharsPerToken)
        + ((1 - CALIBRATION_ALPHA) * this.#charsPerToken);
    }

    this.#logger.debug(
      `Channel ${channelId}: calibrated chars/token to ${this.#charsPerToken.toFixed(2)}`
      + ` (sample: ${sample.promptTokenCount} prompt + ${sample.responseTokenCount} response tokens, ${serialized.length} chars).`
    );
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
    const fullTokenCount: number = this.#estimateTokens(this.#serializeOllamaMessages(fullContext));

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
    const systemPromptTokens: number = this.#estimateTokens(this.#serializeOllamaMessages([systemPrompt]));
    const chunkCapacity: number = contextWindow - systemPromptTokens;

    this.#logger.info(`Conversation exceeds context window (${contextWindow}); chunking into segments for individual summarization.`);

    const chunks: OllamaMessage[][] = this.#splitIntoChunks(conversationContext, chunkCapacity);

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
    const reduceTokenCount: number = this.#estimateTokens(this.#serializeOllamaMessages(reduceContext));

    if (reduceTokenCount <= contextWindow) {
      return this.#generateSummary(reduceContext);
    }

    this.#logger.info(`Combined summaries exceed context window; dropping oldest segment summaries to fit.`);

    let trimmedReduce: OllamaMessage[] = [...reduceContext];
    let trimmedTokens: number = reduceTokenCount;
    const firstChunkSummaryIndex: number = 1 + oldSummaryContext.length;

    while (trimmedTokens > contextWindow && trimmedReduce.length > firstChunkSummaryIndex) {
      trimmedReduce = trimmedReduce.filter((_, idx) => idx !== firstChunkSummaryIndex);
      trimmedTokens = this.#estimateTokens(this.#serializeOllamaMessages(trimmedReduce));
    }

    return this.#generateSummary(trimmedReduce);
  }

  #splitIntoChunks(messages: OllamaMessage[], capacity: number): OllamaMessage[][] {
    if (messages.length === 0) {
      return [];
    }

    const chunks: OllamaMessage[][] = [];
    let currentChunk: OllamaMessage[] = [];
    let currentTokens: number = 0;

    for (const message of messages) {
      const messageTokens: number = this.#estimateTokens(this.#serializeOllamaMessages([message]));

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

  #estimateTokens(text: string): number {
    if (text.length === 0) {
      return 0;
    }

    return Math.ceil(text.length / this.#charsPerToken);
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