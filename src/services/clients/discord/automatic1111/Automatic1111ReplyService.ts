import { AttachmentBuilder, BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { FeatureService } from '../../../features/FeatureService.js';
import { MAX_FILE_NAME_LENGTH } from '../../../../enums/FileConstants.js';
import { Automatic1111Client } from '../../automatic1111/Automatic1111Client.js';
import { IHttpExchangeWithAttachedData } from '../../../../models/IHttpExchangeWithAttachedData.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';
import { SerializableRenderRequest } from '../../automatic1111/models/SerializableRenderRequest.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';
import { StatefulImageGenerationActionRows } from '../components/buttonRows/StatefulImageGenerationActionRows.js';
import { StatelessImageGenerationActionRow } from '../components/buttonRows/StatelessImageGenerationActionRow.js';
import { Txt2ImgOptionsRequest } from '../../automatic1111/models/requests/Txt2ImgOptionsRequest.js';
import { Txt2ImgOptionsResponse } from '../../automatic1111/models/responses/Txt2ImgOptionsResponse.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';

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

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'Automatic1111ReplyService');
    }

    async renderImage(request: SerializableRenderRequest): Promise<IHttpExchangeWithAttachedData<Txt2ImgOptionsRequest, Txt2ImgOptionsResponse, string>> {
        this.#logger(LogLevel.Info, `Render prompt: ${request.prompt}`);

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#automatic1111Client.getModels()).model_name;

        const mappedRequest = request.toTxt2ImgOptionsRequest();
        const renderExchange = await this.#automatic1111Client.render(mappedRequest, model);

        return renderExchange;
    }

    async reply(interaction: Message | ButtonInteraction,
        renderData: IHttpExchangeWithAttachedData<Txt2ImgOptionsRequest, Txt2ImgOptionsResponse, string>,
        content: string | null = null,
        additionalAttachments: Array<AttachmentBuilder> | null = null,
        isEdit: boolean = false): Promise<void> {
        const renderRequest = renderData.exchange.request;
        const renderResponse = renderData.exchange.response;

        const fileName = this.getFileNameFromPrompt(renderRequest);

        const jsonRequest = SerializableRenderRequest.fromTxt2ImgOptionsRequest(renderRequest, renderData.data, JSON.parse(renderResponse.info).seed).toString();

        const isStatefulResponse = jsonRequest.length <= DiscordConstants.ImageDescriptionMaxLength;

        const imageBuffer = Buffer.from(renderResponse.images[0], BufferEncoding.Base64)

        this.#logger(LogLevel.Info, `Attaching render for "${renderRequest.prompt}": ${jsonRequest}`);

        const imageAttachment = new AttachmentBuilder(imageBuffer, {
            name: `${fileName}.png`,
            description: isStatefulResponse ? jsonRequest : null
        });

        let files: Array<AttachmentBuilder> = [imageAttachment];

        if(additionalAttachments) {
            files = files.concat(additionalAttachments);
        }

        const reply: BaseMessageOptions = {
            content,
            files,
            components: isStatefulResponse ?
                new StatefulImageGenerationActionRows(this.#environmentSettings, this.#featureService, renderRequest).build() :
                [new StatelessImageGenerationActionRow(this.#featureService).build()]
        };

        if(interaction instanceof Message) {
            if(isEdit) {
                reply.components = interaction.components;
                await interaction.edit(reply);
            } else {
                await interaction.reply(reply);
            }
        } else if(interaction instanceof ButtonInteraction) {
            await interaction.editReply(reply);
        }
    }

    getFileNameFromPrompt(renderRequest: Txt2ImgOptionsRequest | SerializableRenderRequest): string {
        return `${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }
}
