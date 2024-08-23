import { AttachmentBuilder, BaseMessageOptions, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { FeatureService } from '../../../features/FeatureService.js';
import { MAX_FILE_NAME_LENGTH } from '../../../../enums/FileConstants.js';
import { Automatic1111Client } from '../../automatic1111/Automatic1111Client.js';
import { IHttpExchangeWithAttachedData } from '../../../../models/IHttpExchangeWithAttachedData.js';
import { Txt2ImgOptions } from 'stable-diffusion-api';
import StableDiffusionResult from 'stable-diffusion-api/dist/lib/StableDiffusionResult.js';
import { ContentType } from '../../../../enums/ContentType.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class Automatic1111ReplyService {
    #environmentSettings: EnvironmentSettings;
    #automatic1111Client: Automatic1111Client;
    #featureService: FeatureService;

    #logger;

    get easyDiffusionHost() {
        return this.#automatic1111Client.host;
    }

    constructor(environmentSettings: EnvironmentSettings, featureService: FeatureService, automatic1111Client: Automatic1111Client) {
        this.#environmentSettings = environmentSettings;
        this.#featureService = featureService;
        this.#automatic1111Client = automatic1111Client;

        this.#logger = new Logger(environmentSettings.isProduction, 'Automatic1111ReplyService');
    }

    async reply(message: Message, renderData: IHttpExchangeWithAttachedData<Txt2ImgOptions, StableDiffusionResult, string>): Promise<void> {
        const renderRequest = renderData.exchange.request;
        const renderResponse = renderData.exchange.response;

        const fileName = this.getFileNameFromPrompt(renderRequest);

        const jsonRequest = JSON.stringify(renderData);
        const isStatefulResponse = jsonRequest.length <= DiscordConstants.ImageDescriptionMaxLength;

        const imageBuffer = await renderResponse.image.png().toBuffer();

        this.#logger(LogLevel.Info, `Attaching render for "${renderRequest.prompt}": ${jsonRequest}`);

        const imageAttachment = new AttachmentBuilder(imageBuffer, {
            name: `${fileName}.${ContentType.Png}`,
            description: isStatefulResponse ? jsonRequest : null
        });

        const reply: BaseMessageOptions = {
            files: [imageAttachment]
        };

        await message.reply(reply);
    }

    getFileNameFromPrompt(renderRequest: Txt2ImgOptions): string {
        return `${renderRequest.seed}_${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }
}
