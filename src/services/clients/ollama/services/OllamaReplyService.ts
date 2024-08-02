import { AttachmentBuilder, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IHttpExchange } from '../../../../models/IHttpExchange.js';
import { GenerateRequest, GenerateResponse } from 'ollama';
import { splitText } from '../../../../utilities/string-utilities.js';
import { DiscordConstants } from '../../discord/enums/DiscordConstants.js';
import { FeatureService } from '../../../features/FeatureService.js';
import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { IStreamResponse } from '../../easy-diffusion/models/responses/IStreamResponse.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';

export class OllamaReplyService {
    #environmentSettings: EnvironmentSettings;
    #featureService: FeatureService;
    #easyDiffusionReplyService = EasyDiffusionReplyService;

    #logger;

    constructor(
        environmentSettings: EnvironmentSettings,
        featureService: FeatureService,
        easyDiffusionReplyService: EasyDiffusionReplyService) {
        this.#environmentSettings = environmentSettings;
        this.#featureService = featureService;
        this.#easyDiffusionReplyService = easyDiffusionReplyService;

        this.#logger = new Logger(environmentSettings.isProduction, 'PromptResponseTask');
    }

    async reply(message: Message, exchange: IHttpExchange<GenerateRequest, GenerateResponse>): Promise<void> {
        const responses = splitText(exchange.response.response, DiscordConstants.ContentMaxLength);

        responses.forEach(async (response, i) => {
            const reply = await message.reply(response);

            if(i === responses.length - 1 && this.#featureService.hasFeature(SupportedFeature.ImagesAttachedToText)) {
                await this.#attachImage(reply, exchange.response.response);
            }
        });
    }

    async attachImage(message: Message, streamResponse: IStreamResponse): Promise<void> {
        const files: Array<AttachmentBuilder> = [];
        const imageBuffer = Buffer.from(streamResponse.output[0].data.split(",")[1], BufferEncoding.Base64);

        files.push(new AttachmentBuilder(imageBuffer, {
            name: `${this.#getFileNameFromPrompt(renderRequest)}.${renderRequest.output_format}`
        }));

        await message.edit({
            content: message.content,
            files: files
        });
    }
}
