import { Message } from 'discord.js';

import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ILogger } from '../../../../ILogger.js';
import { IChatMessage } from '../../IChatMessage.js';
import { IChatMessageFactory } from '../../IChatMessageFactory.js';
import { IChatMessageFilter } from '../../IChatMessageFilter.js';

export class OllamaStreamingReplyService {
    readonly #services: IBotServiceContainer;
    readonly #logger: ILogger;
    readonly #filters: IChatMessageFilter[];
    readonly #factory: IChatMessageFactory<Message>;

    #replies: Message[] = [];
    #accumulatedContent = '';

    constructor(services: IBotServiceContainer) {
        this.#services = services;
        this.#logger = services.getLogger('OllamaStreamingReplyService');
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
            chatMessages = filter.processStreaming(chatMessages, done);
        }

        this.#logger.info(`Processing ${chatMessages.length} messages.`);

        this.#replies = await this.#factory.updateMessages(message, this.#replies, chatMessages);

        return this.#replies;
    }

    clearState(): void {
        this.#replies = [];
        this.#accumulatedContent = '';
    }
}