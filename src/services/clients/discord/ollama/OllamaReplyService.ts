import { Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';
import { GenerateRequest, GenerateResponse } from 'ollama';

import { IHttpExchange } from '../../../../models/IHttpExchange.js';
import { splitText } from '../../../../utilities/string-utilities.js';
import { DiscordConstants } from '../../discord/enums/DiscordConstants.js';
import { LargeLanguageModelActionRow } from '../../discord/components/buttonRows/LargeLanguageModelActionRow.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';

export class OllamaReplyService {
    #services: IServiceContainer;

    #environmentSettings: EnvironmentSettings;

    #logger;

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#environmentSettings = services.environmentSettings;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'OllamaReplyService');
    }

    async reply(message: Message, exchange: IHttpExchange<GenerateRequest, GenerateResponse>): Promise<Array<Message>> {
        const responses = splitText(exchange.response.response, DiscordConstants.ContentMaxLength);
        const replies: Array<Message> = [];

        this.#logger(LogLevel.Info, `Replying with ${responses.length} messages.`);

        let i = 0;

        for (const response of responses) {
            if(i === responses.length - 1) {
                replies.push(await message.reply({
                    content: response,
                    components: [new LargeLanguageModelActionRow(this.#services).build()]
                }));
            } else {
                replies.push(await message.reply(response));
            }

            i++;
        }

        return replies;
    }
}
