import { Message } from 'discord.js';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ILogger } from '../../../../ILogger.js';
import { ILlmRequest } from '../../../llm/models/ILlmRequest.js';
import { LlmChatResult } from '../../../llm/models/LlmChatResult.js';
import { IChatMessage } from '../../IChatMessage.js';
import { IChatMessageFactory } from '../../IChatMessageFactory.js';
import { IOutputChatMessageFilter } from '../../IOutputChatMessageFilter.js';

export class LlmReplyService {
  readonly #services: IBotServiceContainer;
  readonly #logger: ILogger;
  readonly #filters: IOutputChatMessageFilter[];
  readonly #factory: IChatMessageFactory<Message>;

  constructor(services: IBotServiceContainer) {
    this.#services = services;
    this.#logger = services.getLogger('LlmReplyService');
    this.#filters = services.getChatMessageFilters();
    this.#factory = services.getChatMessageFactory<Message>();
  }

  async reply(
    message: Message,
    exchange: IHttpExchange<ILlmRequest, LlmChatResult>,
    prependedText: string = ''): Promise<Message[]> {
    const initialMessage: IChatMessage = {
      content: `${prependedText} ${exchange.response.message.content}`,
      attachments: []
    };

    let messages: IChatMessage[] = [initialMessage];

    for (const filter of this.#filters) {
      messages = await filter.process(messages);
    }

    this.#logger.info(`Replying with ${messages.length} messages.`);

    return await this.#factory.createMessages(message, messages);
  }
}