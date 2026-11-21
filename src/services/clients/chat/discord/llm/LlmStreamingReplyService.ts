import { Message } from 'discord.js';

import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ILogger } from '../../../../ILogger.js';
import { IChatMessage } from '../../IChatMessage.js';
import { IChatMessageFactory } from '../../IChatMessageFactory.js';
import { IOutputChatMessageFilter } from '../../IOutputChatMessageFilter.js';

export class LlmStreamingReplyService {
  readonly #services: IBotServiceContainer;
  readonly #logger: ILogger;
  readonly #filters: IOutputChatMessageFilter[];
  readonly #factory: IChatMessageFactory<Message>;

  #replies: Message[] = [];
  #accumulatedContent = '';

  constructor(services: IBotServiceContainer) {
    this.#services = services;
    this.#logger = services.getLogger('LlmStreamingReplyService');
    this.#filters = services.getChatMessageFilters();
    this.#factory = services.getChatMessageFactory<Message>();
  }

  async reply(
    message: Message,
    responseBatch: string,
    done: boolean): Promise<Message[]> {
    this.#accumulatedContent += responseBatch;

    let chatMessages: IChatMessage[] = [{
      content: this.#accumulatedContent,
      attachments: []
    }];

    for (const filter of this.#filters) {
      chatMessages = await filter.processStreaming(chatMessages, done);
    }

    this.#logger.info(`Processing ${chatMessages.length} messages.`);

    this.#replies = await this.#factory.updateMessages(message, this.#replies, chatMessages);

    return this.#replies;
  }

  // Reasoning-capable models stream their thinking before the answer. The
  // reasoning view is ephemeral: it is shown in place of the answer message
  // and is fully replaced once answer content starts flowing (reply()
  // accumulates answer content from zero and rewrites the same messages).
  // Nothing accumulates here and no output filters run — the view is
  // display-only.
  async showReasoning(message: Message, view: string): Promise<void> {
    const chatMessages: IChatMessage[] = [{
      content: view,
      attachments: []
    }];

    this.#replies = await this.#factory.updateMessages(message, this.#replies, chatMessages);
  }

  clearState(): void {
    this.#replies = [];
    this.#accumulatedContent = '';
  }
}