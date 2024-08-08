import { Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';
import { GenerateRequest, GenerateResponse } from 'ollama';

import { IHttpExchange } from '../../../../models/IHttpExchange.js';
import { splitText } from '../../../../utilities/string-utilities.js';
import { DiscordConstants } from '../../discord/enums/DiscordConstants.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { LargeLanguageModelRow } from '../../discord/components/buttonRows/LargeLanguageModelRow.js';
import { FeatureService } from '../../../features/FeatureService.js';

export class OllamaReplyService {
    #environmentSettings: EnvironmentSettings;
    #featureService: FeatureService;

    #logger;

    constructor(
        environmentSettings: EnvironmentSettings,
        featureService: FeatureService,) {
        this.#environmentSettings = environmentSettings;
        this.#featureService = featureService;

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
                    components: [new LargeLanguageModelRow(this.#featureService).build()]
                }));
            } else {
                replies.push(await message.reply(response));
            }

            i++;
        }

        return replies;
    }
}
