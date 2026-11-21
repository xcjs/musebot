import { Message as DiscordMessage } from 'discord.js';

import { IHttpExchange } from '../../../../models/IHttpExchange.js';
import { endsWithWhitespace, hasOnly, isOnlyWhitespace } from '../../../../utilities/string-utilities.js';
import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../features/IFeatureService.js';
import { IBotServiceContainer } from "../../../IBotServiceContainer.js"
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { DiscordConstants } from '../../chat/discord/enums/DiscordConstants.js';
import { DiscordAttachmentService } from '../../chat/discord/services/DiscordAttachmentService.js';
import { IInputChatMessageFilter } from '../../chat/IInputChatMessageFilter.js';
import { LLM_TEMPERATURE_DEFAULT } from '../constants/LlmConstants.js';
import { LlmRole } from '../enums/LlmRole.js';
import { ILlmRequest } from '../models/ILlmRequest.js';
import { LlmChatMessage } from '../models/LlmChatMessage.js';
import { LlmChatResult } from '../models/LlmChatResult.js';
import { LlmGenerateResult } from '../models/LlmGenerateResult.js';
import { LlmMessage } from '../models/LlmMessage.js';
import { ILlmChatMessageFactory } from '../services/ILlmChatMessageFactory.js';
import { IMemoryService } from '../services/IMemoryService.js';
import { WebContentService } from '../services/web/WebContentService.js';
import { LlmBaseTask } from './LlmBaseTask.js';

export class LlmMessageTask extends LlmBaseTask<void> {
  readonly #services: IBotServiceContainer;

  readonly #featureService: IFeatureService;
  readonly #taskQueue: ITaskQueue;

  readonly #inputFilters: IInputChatMessageFilter<DiscordMessage>[];
  readonly #llmChatMessageFactory: ILlmChatMessageFactory<DiscordMessage>;
  readonly #memoryService: IMemoryService;
  readonly #attachmentService: DiscordAttachmentService;
  readonly #webContentService: WebContentService;

  readonly #message: DiscordMessage;

  constructor(
    services: IBotServiceContainer,
    message: DiscordMessage) {
    super(services);
    this.logger = services.getLogger('LlmMessageTask');

    this.#services = services;

    this.#featureService = services.featureService;
    this.#taskQueue = services.taskQueue;
    this.#inputFilters = services.getInputChatMessageFilters<DiscordMessage>();
    this.#llmChatMessageFactory = services.getLlmChatMessageFactory<DiscordMessage>();
    this.#memoryService = services.getMemoryService();
    this.#attachmentService = new DiscordAttachmentService();
    this.#webContentService = services.webContentService;

    this.#message = message;
  }

  override async process(): Promise<void> {
    await super.process();

    const llmChatMessage = this.#llmChatMessageFactory.create(this.#message);
    const formattedMessage = JSON.stringify(llmChatMessage);

    // Compress context BEFORE reading it for the upcoming request so that
    // context + generated tokens stay under the model's context window and
    // the host never triggers a context-shift checkpoint mid-generation
    // (which would stall the HTTP stream indefinitely). Post-response
    // compression alone (called below after the response completes) cannot
    // prevent overflow of the in-flight request.
    await this.#services.getContextCompressionService().compressIfNeeded(this.#message.channelId);

    let context = this.contextService.getContextByChannelId(this.#message.channelId);

    for (const filter of this.#inputFilters) {
      context = await filter.process(llmChatMessage, this.#message, context);
    }

    const webContext = await this.#getWebContext(llmChatMessage.message);

    if (webContext !== null) {
      context = [...context, webContext];
    }

    const images = await this.#getImages();

    if (this.configurationService.llmStreamsResponse) {
      await this.#processAsStream(formattedMessage, context, llmChatMessage, images);
      return;
    }

    const exchange = await this.llmClient.sendMessage(formattedMessage, context, images);

    this.contextService.addContext([this.contextMessageFactory.fromChatMessage(this.#message)]);
    this.contextService.addContext([
      this.contextMessageFactory.fromLlmMessage(exchange.exchange.response.message,
        this.#message.id, this.#message.author.id, this.#message.channelId, this.#message.guildId)]);

    const response: LlmChatResult = exchange.exchange.response;
    await this.#services.getContextCompressionService().compressIfNeeded(this.#message.channelId, {
      promptTokenCount: response.promptTokens,
      responseTokenCount: response.completionTokens
    });

    await this.#storeMemories(llmChatMessage, response.message.content);

    const replies = await this.llmReplyService.reply(this.#message, exchange.exchange);

    if (this.#featureService.hasFeature(SupportedFeature.Txt2Img)
      && replies.length > 0) {
      this.#attachImage(exchange.exchange.response.message.content, replies);
    }
  }

  override async postProcess(): Promise<void> {
    await super.postProcess();

    switch (this.taskStatus) {
      case TaskStatus.Dead:
        await this.replyService.replyWithError(this.#message);
        break;
    }

    this.llmStreamingReplyService.clearState();
  }

  async #processAsStream(formattedMessage: string, context: LlmMessage[], llmChatMessage: LlmChatMessage, images: string[]): Promise<void> {
    const exchange = await this.llmClient.sendMessageAndGetStream(formattedMessage, context, images);

    let averageResponseInMs = 0;
    let endTime = performance.now();
    const minimumEditIntervalMs = 1000 / DiscordConstants.MaxStreamingEditsPerSecond;

    let fullResponse = '';
    let responseBatch = '';
    let reasoning = '';
    let lastReasoningView: string | null = null;
    let contentStarted = false;

    if(!exchange?.exchange?.response) {
      return;
    }

    for await (const response of exchange.exchange.response) {
      const startTime = performance.now();
      let replies: DiscordMessage[] = [];

      if (response.content.trim().length > 0) {
        contentStarted = true;
      }

      fullResponse += response.content;
      responseBatch += response.content;

      // Reasoning deltas stop contributing to the view once the answer has
      // started; the reasoning display is about to be replaced by it.
      if (response.reasoning !== undefined && response.reasoning.length > 0 && !contentStarted) {
        reasoning += response.reasoning;
      }

      if (!response.done) {
        // Ensure we're not sending edits faster than Discord's message-edit
        // rate limit (5 edits per 5 seconds per channel) can process them.
        // Token chunks can arrive far faster than Discord will accept edits,
        // so edit pacing must be decoupled from the token arrival rate.
        if (startTime - endTime < minimumEditIntervalMs
          || startTime - endTime < averageResponseInMs
        ) {
          continue;
        }

        if (!contentStarted) {
          // Reasoning phase: no answer text yet, so the message shows the
          // recent reasoning as a sliding view. The next content flush below
          // overwrites this view in place with the start of the answer.
          if (reasoning.length === 0) {
            continue;
          }

          const view = this.#renderReasoningView(reasoning);

          if (view === lastReasoningView) {
            continue;
          }

          lastReasoningView = view;
          await this.llmStreamingReplyService.showReasoning(this.#message, view);

          endTime = performance.now();
          averageResponseInMs = (averageResponseInMs + endTime - startTime) / 2;
          this.logger.debug(`The average streaming response time is ${averageResponseInMs}ms.`);
          continue;
        }

        // Discord automatically trims message edits that are only whitespace.
        if (isOnlyWhitespace(responseBatch)) {
          continue;
        }

        // If the message is appended with whitespace the end, Discord will
        // trim it, leading to an accumulation of formatting issues.
        if (endsWithWhitespace(responseBatch)) {
          continue;
        }

        // Messages that only contain a double asterisk are, under certain
        // conditions, converted to a newline. This attempts to prevent that
        // by delaying the batch until additional characters are included.
        if (hasOnly(responseBatch, '*')) {
          continue;
        }
      }

      if (response.done && !contentStarted) {
        // The stream ended during the reasoning phase: finalize the reasoning
        // view — there is no answer text to send.
        if (reasoning.length > 0) {
          const finalView = this.#renderReasoningView(reasoning);

          if (finalView !== lastReasoningView) {
            lastReasoningView = finalView;
            await this.llmStreamingReplyService.showReasoning(this.#message, finalView);
          }
        }
      } else {
        replies = await this.llmStreamingReplyService.reply(this.#message, responseBatch, response.done);
        responseBatch = '';
      }

      if (response.done) {
        const assistantMessage: LlmMessage = { role: LlmRole.Assistant, content: fullResponse };

        this.contextService.addContext([this.contextMessageFactory.fromChatMessage(this.#message)]);
        this.contextService.addContext([
          this.contextMessageFactory.fromLlmMessage(assistantMessage,
            this.#message.author.id,
            this.#message.guildId,
            this.#message.channelId,
            this.#message.guildId
          )]);

        await this.#services.getContextCompressionService().compressIfNeeded(this.#message.channelId, {
          promptTokenCount: response.promptTokens,
          responseTokenCount: response.completionTokens
        });

        await this.#storeMemories(llmChatMessage, fullResponse);

        if (this.#featureService.hasFeature(SupportedFeature.Txt2Img)
          && replies.length > 0) {
          this.#attachImage(fullResponse, replies);
        }
      }

      endTime = performance.now();
      averageResponseInMs = (averageResponseInMs + endTime - startTime) / 2;
      this.logger.debug(`The average streaming response time is ${averageResponseInMs}ms.`);
    }
  }

  // Renders the ephemeral reasoning view: a label above a code-fenced tail
  // of the most recent reasoning, always under Discord's 2000 character
  // message limit and locked to the configured line count. Rendered fresh
  // on every flush so the sliding window follows the model's thinking.
  #renderReasoningView(reasoning: string): string {
    const reasoningLabel = '🤔 *Thinking…*';
    // Reasoning must survive alongside the eventual answer, so hold a small
    // margin under Discord's message character limit.
    const maxReasoningViewChars = DiscordConstants.ContentMaxLength - 200;
    const maxReasoningViewLines = this.configurationService.llmReasoningViewLines;

    if (reasoning.length === 0) {
      return reasoningLabel;
    }

    // Neutralize code fences: the content is wrapped in a fence below, so a
    // fence in the reasoning itself would otherwise terminate the block.
    const lines = reasoning.replace(/`{3,}/gu, '\u2026').split('\n');
    const tailLines: string[] = [];
    // Fixed scaffold: "\n\n```markdown\n" after the label and "\n```" before
    // the message end.
    let budget = maxReasoningViewChars - reasoningLabel.length - 18;

    for (let i = lines.length - 1; i >= 0 && budget > 0 && tailLines.length < maxReasoningViewLines; i -= 1) {
      const line = lines[i].length > 600 ? lines[i].slice(-600) : lines[i];

      // Blank lines (including the one a trailing newline leaves behind)
      // render as dangling empty rows; skip them without spending budget.
      if (line.length === 0) {
        continue;
      }

      const cost = line.length + 1; // a trailing newline

      if (cost > budget) {
        if (tailLines.length === 0) {
          tailLines.push(line.slice(-Math.max(0, budget - 2)));
        }

        break;
      }

      tailLines.push(line);
      budget -= cost;
    }

    tailLines.reverse();

    // Lock the view height: pad blank rows above the tail when reasoning is
    // shorter than the configured line count, so the box never resizes
    // mid-stream.
    const paddingRows = Math.min(Math.max(0, maxReasoningViewLines - tailLines.length), budget);
    const body: string[] = [];

    for (let i = 0; i < paddingRows; i += 1) {
      body.push('');
    }

    for (const line of tailLines) {
      body.push(line);
    }

    return `${reasoningLabel}\n\n\`\`\`markdown\n${body.join('\n')}\n\`\`\``;
  }

  async #storeMemories(llmChatMessage: LlmChatMessage, botResponseContent: string): Promise<void> {
    if (!this.#memoryService.isEnabled) {
      return;
    }

    try {
      const botLlmChatMessage = this.#llmChatMessageFactory.createFromLlmResponse(botResponseContent, this.#message);
      await this.#memoryService.store(botLlmChatMessage, llmChatMessage.userId);
    } catch (error) {
      this.logger.error('Failed to store memories:', error);
    }
  }

  async #getImages(): Promise<string[]> {
    if (!this.#featureService.hasFeature(SupportedFeature.Vision)) {
      return [];
    }

    try {
      return await this.#attachmentService.getAttachedImagesAsBase64(this.#message);
    } catch (error) {
      this.logger.error('Failed to fetch image attachments for vision request:', error);
      return [];
    }
  }

  async #getWebContext(messageText: string): Promise<LlmMessage | null> {
    if (!this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
      return null;
    }

    const urls = this.#webContentService.extractUrls(messageText);

    if (urls.length === 0) {
      return null;
    }

    try {
      const results = await this.#webContentService.fetchAll(urls);

      if (results.length === 0) {
        return null;
      }

      const sections = results.map((result) =>
        `## ${result.title}\nSource: ${result.url}\n\n${result.content}`);
      const content = `The user's message references the following web pages.`
        + ` Use this content to inform your response:\n\n${sections.join('\n\n---\n\n')}`;

      this.logger.info(`Fetched ${results.length} web page(s) for context: ${results.map(r => r.url).join(', ')}`);

      return {
        role: LlmRole.System,
        content
      };
    } catch (error) {
      this.logger.error('Failed to fetch web content for context:', error);
      return null;
    }
  }

  #attachImage(prompt: string, replies: Array<DiscordMessage>): void {
    this.logger.info('An image will be attached to the LLM response.');

    const lastReply = replies[replies.length - 1];

    if (!this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
      this.#enqueueAttachmentTask(lastReply, prompt);
      return;
    }

    const llmImagePrompt = 'The following prompt is a response to a message.'
      + ' Describe an artistic or creative image to go with this response.'
      + ' Keep in mind that the image generation model that will receive this prompt can only accurately include brief snippets of text 2-3 words in length.'
      + ' If you do decide to include any text in the image, make sure to surround it with quotes and remain brief.'
      + `\n\n\`\`\`text\n${prompt}\n\`\`\``;

    const generateTask = this.#services.getLlmGenerateTask(llmImagePrompt, LLM_TEMPERATURE_DEFAULT);
    generateTask.isChild = true;

    generateTask.onSuccess = (payload: IHttpExchange<ILlmRequest, LlmGenerateResult>): void => {
      this.#enqueueAttachmentTask(lastReply, payload.response.content);
    };

    generateTask.onFailure = (error: Error): void => {
      this.logger.error('Failed to generate an image for the prompt. Falling back to the original LLM response to generate an image instead.', error);
      this.#enqueueAttachmentTask(lastReply, prompt);
    };

    this.#taskQueue.add(generateTask as BaseTask<unknown>);
  }

  #enqueueAttachmentTask(message: DiscordMessage, prompt: string): void {
    const attachTask = this.#services.getAttachmentTask(message, prompt) as BaseTask<void>;
    this.#taskQueue.add(attachTask as BaseTask<unknown>);
  }
}