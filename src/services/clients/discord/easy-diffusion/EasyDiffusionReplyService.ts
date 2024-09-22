import { AttachmentBuilder, BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IHttpExchangeWithAttachedResponse } from '../../../../models/IHttpExchangeWithAttachedResponse.js';
import { RenderRequest } from '../../easy-diffusion/models/requests/RenderRequest.js';
import { IRenderResponse } from '../../easy-diffusion/models/responses/IRenderResponse.js';
import { IStreamResponse } from '../../easy-diffusion/models/responses/IStreamResponse.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';
import { StatefulImageGenerationActionRows } from '../components/buttonRows/StatefulImageGenerationActionRows.js';
import { StatelessImageGenerationActionRow } from '../components/buttonRows/StatelessImageGenerationActionRow.js';
import { MAX_FILE_NAME_LENGTH } from '../../../../enums/FileConstants.js';
import { UpscaledRenderRequest } from '../../easy-diffusion/models/requests/UpscaledRenderRequest.js';
import { IServiceContainer } from '../../../IServiceContainer.js';

export class EasyDiffusionReplyService {
    #services: IServiceContainer;

    #logger;

    get host() {
        return this.#services.easyDiffusionClient.host;
    }

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#logger = new Logger(this.#services.environmentSettings.isProduction, 'EasyDiffusionReplyService');
    }

    async renderImage(request: RenderRequest | UpscaledRenderRequest): Promise<IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse>> {
        this.#logger(LogLevel.Info, `Render prompt: ${request.prompt}`);

        const renderExchange = await this.#services.easyDiffusionClient.render(request);

        if(renderExchange === null || renderExchange.response === null) {
            return Promise.reject('The render request failed.');
        }

        const streamResponse = await this.#services.easyDiffusionClient.stream(renderExchange);

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
                new StatefulImageGenerationActionRows(this.#services.environmentSettings, this.#services.featureService, renderRequest).build() :
                [new StatelessImageGenerationActionRow(this.#services.featureService).build()]
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
