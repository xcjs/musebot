import { AttachmentBuilder, BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { MAX_FILE_NAME_LENGTH } from '../../../../../constants/FileConstants.js';
import { IHttpExchangeWithAttachedResponse } from '../../../../../models/IHttpExchangeWithAttachedResponse.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { EasyDiffusionClient } from '../../../images/easy-diffusion/EasyDiffusionClient.js';
import { RenderRequest } from '../../../images/easy-diffusion/models/requests/RenderRequest.js';
import { UpscaledRenderRequest } from '../../../images/easy-diffusion/models/requests/UpscaledRenderRequest.js';
import { IRenderResponse } from '../../../images/easy-diffusion/models/responses/IRenderResponse.js';
import { IStreamResponse } from '../../../images/easy-diffusion/models/responses/IStreamResponse.js';
import { StatefulImageGenerationActionRows } from '../components/buttonRows/StatefulImageGenerationActionRows.js';
import { StatelessImageGenerationActionRow } from '../components/buttonRows/StatelessImageGenerationActionRow.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class EasyDiffusionReplyService {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #easyDiffusionClient: EasyDiffusionClient;

    #logger;

    get host() {
        return this.#easyDiffusionClient.host;
    }

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#easyDiffusionClient = services.easyDiffusionClient;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'EasyDiffusionReplyService');
    }

    async renderImage(request: RenderRequest | UpscaledRenderRequest): Promise<IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse>> {
        this.#logger(LogLevel.Info, `Render prompt: ${request.prompt}`);

        const renderExchange = await this.#easyDiffusionClient.render(request);

        if(renderExchange === null || renderExchange.response === null) {
            return Promise.reject('The render request failed.');
        }

        const streamResponse = await this.#easyDiffusionClient.stream(renderExchange);

        if(streamResponse === null) {
            return Promise.reject('The stream request failed.');
        }

        return {
            exchange: renderExchange,
            response: streamResponse
        };
    }

    async reply(
        interaction: Message | ButtonInteraction,
        renderData: IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse>,
        content: string | null = null,
        additionalAttachments: Array<AttachmentBuilder> | null = null,
        isEdit: boolean = false): Promise<void> {
        const renderRequest = renderData.exchange.request;
        const streamResponse = renderData.response;

        const fileName = this.getFileNameFromPrompt(renderRequest);
        const jsonRequest = JSON.stringify(renderRequest);
        const isStatefulResponse = jsonRequest.length <= DiscordConstants.ImageDescriptionMaxLength;

        const imageBuffer = Buffer.from(streamResponse.output[0].data.split(',')[1], BufferEncoding.Base64);

        const imageAttachment = new AttachmentBuilder(imageBuffer, {
            name: `${fileName}.${renderRequest.output_format}`,
            description: isStatefulResponse ? jsonRequest : null
        });

        let files: Array<AttachmentBuilder> = [imageAttachment];

        if(additionalAttachments) {
            files = files.concat(additionalAttachments);
        }

        this.#logger(LogLevel.Info, `Attaching render for "${renderRequest.prompt}": ${jsonRequest}`);

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

    getFileNameFromPrompt(renderRequest: RenderRequest): string {
        return `${renderRequest.seed}_${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }
}
