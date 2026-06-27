import { Message } from 'discord.js';
import { ChatRequest, ChatResponse } from 'ollama';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ILogger } from '../../../../ILogger.js';
import { IChatMessage } from '../../IChatMessage.js';
import { IChatMessageFactory } from '../../IChatMessageFactory.js';
import { IChatMessageFilter } from '../../IChatMessageFilter.js';

export class OllamaReplyService {
    readonly #services: IBotServiceContainer;
    readonly #logger: ILogger;
    readonly #filters: IChatMessageFilter[];
    readonly #factory: IChatMessageFactory<Message>;

    constructor(services: IBotServiceContainer) {
        this.#services = services;
        this.#logger = services.getLogger('OllamaReplyService');
        this.#filters = services.getChatMessageFilters();
        this.#factory = services.getChatMessageFactory<Message>();
    }

    async reply(
        message: Message,
        exchange: IHttpExchange<ChatRequest, ChatResponse>,
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