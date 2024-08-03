import { Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';
import { GenerateRequest, GenerateResponse } from 'ollama';

import { EnvironmentSettings } from '../../../EnvironmentSettings';
import { IHttpExchange } from '../../../../models/IHttpExchange';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService';
import { FeatureService } from '../../../features/FeatureService';
import { DiscordConstants } from '../../discord/enums/DiscordConstants';
import { splitText } from '../../../../utilities/string-utilities';

export class OllamaStreamingReplyService {
    #environmentSettings: EnvironmentSettings;
    #featureService: FeatureService;
    #easyDiffusionReplyService: EasyDiffusionReplyService

    #logger;

    #replies: Array<Message> = [];

    constructor(
        environmentSettings: EnvironmentSettings,
        featureService: FeatureService,
        easyDiffusionReplyService: EasyDiffusionReplyService) {
        this.#environmentSettings = environmentSettings;
        this.#featureService = featureService;
        this.#easyDiffusionReplyService = easyDiffusionReplyService;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'OllamaStreamingReplyService');
    }

    async reply(message: Message, exchange: IHttpExchange<GenerateRequest, AsyncIterable<GenerateResponse>>): Promise<void> {
        let reply: Message<boolean> | null = null;
        let startTime = performance.now();
        let fullResponse = '';
        let responseBatch = '';

        for await (const response of exchange.response) {
            console.log(`Appending "${response.response}"`);
            responseBatch += response.response;

            if(performance.now() - startTime >= 1000 / DiscordConstants.MaxRequestsPerSecond || response.done) {
                console.log('Flushing response batch.');

                if(reply === null || reply.content.length + responseBatch.length > DiscordConstants.ContentMaxLength) {
                    reply = await message.reply(responseBatch);
                } else if(responseBatch.length > DiscordConstants.ContentMaxLength) {
                    const responseBatches = splitText(responseBatch, DiscordConstants.ContentMaxLength);

                    responseBatches.forEach(async (response) => {
                        this.#replies.push(await message.reply(response));
                    });
                }
                else {
                    await reply.edit(`${reply.content}${responseBatch}`);
                }

                fullResponse += responseBatch;
                responseBatch = '';

                startTime = performance.now();
            }

            if(response.done) {
                this.#context = response.context;
            }
        }

        if(this.#featureService.hasFeature(SupportedFeature.ImagesAttachedToText)) {
            await this.#attachImage(reply, fullResponse);
        }
    }
}
