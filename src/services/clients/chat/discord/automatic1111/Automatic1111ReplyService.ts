import { AttachmentBuilder, BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { MAX_FILE_NAME_LENGTH } from '../../../../../enums/FileConstants.js';
import { IHttpExchangeWithAttachedData } from '../../../../../models/IHttpExchangeWithAttachedData.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { Automatic1111Client } from '../../../images/automatic1111/Automatic1111Client.js';
import { UpscalerRequestFactory } from '../../../images/automatic1111/factories/UpscalerRequestFactory.js';
import { Txt2ImgOptionsRequest } from '../../../images/automatic1111/models/requests/Txt2ImgOptionsRequest.js';
import { ExtraSingleImageResponse } from '../../../images/automatic1111/models/responses/ExtraSingleImageResponse.js';
import { Txt2ImgOptionsResponse } from '../../../images/automatic1111/models/responses/Txt2ImgOptionsResponse.js';
import { SerializableRenderRequest } from '../../../images/stable-diffusion/models/SerializableRenderRequest.js';
import { StatefulImageGenerationActionRows } from '../components/buttonRows/StatefulImageGenerationActionRows.js';
import { StatelessImageGenerationActionRow } from '../components/buttonRows/StatelessImageGenerationActionRow.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class Automatic1111ReplyService {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #automatic1111Client: Automatic1111Client;

    #logger;

    get host() {
        return this.#automatic1111Client.host;
    }

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#automatic1111Client = services.automatic1111Client;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'Automatic1111ReplyService');
    }

    async renderImage(request: Txt2ImgOptionsRequest, model: string): Promise<IHttpExchangeWithAttachedData<Txt2ImgOptionsRequest, Txt2ImgOptionsResponse, string>> {
        this.#logger(LogLevel.Info, `Render prompt: ${request.prompt}`);

        const renderExchange = await this.#automatic1111Client.render(request, model);

        return renderExchange;
    }

    async upscaleImage(image: string): Promise<ExtraSingleImageResponse> {
        this.#logger(LogLevel.Info, 'Upscaling an image...');

        const request = UpscalerRequestFactory.getFourTimesUpscaleSettings(image);
        return await this.#automatic1111Client.upscaleImage(request);
    }

    async reply(interaction: Message | ButtonInteraction,
        renderData: IHttpExchangeWithAttachedData<Txt2ImgOptionsRequest, Txt2ImgOptionsResponse, string>,
        content: string | null = null,
        additionalAttachments: Array<AttachmentBuilder> | null = null,
        isEdit: boolean = false): Promise<void> {
        const renderRequest = renderData.exchange.request;
        const renderResponse = renderData.exchange.response;

        const actualSeed = (JSON.parse(renderResponse.info) as Txt2ImgOptionsRequest).seed;
        renderResponse.parameters.seed = actualSeed;

        const fileName = this.getFileNameFromPrompt(renderResponse.parameters);

        const jsonRequest = SerializableRenderRequest.fromTxt2ImgOptionsRequest(renderRequest, renderData.data, actualSeed).toString();

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
                new StatefulImageGenerationActionRows(this.#services, renderRequest).build() :
                [new StatelessImageGenerationActionRow(this.#services).build()]
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
        return `${renderRequest.seed}_${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }
}
