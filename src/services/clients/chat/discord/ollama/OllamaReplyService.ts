import { Message } from 'discord.js';
import { ChatRequest, ChatResponse } from 'ollama';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { splitText } from '../../../../../utilities/string-utilities.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { LargeLanguageModelActionRow } from '../components/buttonRows/LargeLanguageModelActionRow.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class OllamaReplyService {
    #services: IServiceContainer;

    #logger: ILogger;

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#logger = services.getLogger('OllamaReplyService');
    }

    async reply(
        message: Message,
        exchange: IHttpExchange<ChatRequest, ChatResponse>,
        prependedText: string = ''): Promise<Message[]> {
        const responses = splitText(`${prependedText} ${exchange.response.message.content}`, DiscordConstants.ContentMaxLength);
        const replies: Message[] = [];

        this.#logger.info(`Replying with ${responses.length} messages.`);

        let i = 0;

        for (const response of responses) {
            // If it's the last reply, include the action row.
            if(i === responses.length - 1) {
                replies.push(await message.reply({
                    content: response,
                    components: new LargeLanguageModelActionRow(this.#services).build()
                }));
            } else {
                replies.push(await message.reply(response));
            }

            i++;
        }

        return replies;
    }
}
