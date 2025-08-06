import { ActionRowBuilder, AttachmentBuilder, BaseMessageOptions, ButtonBuilder, ButtonInteraction, Message } from 'discord.js';

import { MAX_FILE_NAME_LENGTH } from '../../../../../constants/FileConstants.js';
import { APPLICATION_NAME } from '../../../../../constants/Globals.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ComfyUiClient } from '../../../images/comfy-ui/ComfyUiClient.js';
import { MediaCollectionResponse } from '../../../images/comfy-ui/extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../../../images/stable-diffusion/models/SerializableRenderRequest.js';
import { IReplyService } from '../../IReplyService.js';
import { Img2ImgActionRow } from '../components/buttonRows/Img2ImgActionRow.js';
import { StatefulAudioGenerationActionRow } from '../components/buttonRows/StatefulAudioGenerationActionRow.js';
import { StatefulImageGenerationActionRows } from '../components/buttonRows/StatefulImageGenerationActionRows.js';
import { StatelessImageGenerationActionRow } from '../components/buttonRows/StatelessImageGenerationActionRow.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class ComfyUiReplyService {
    #services: IServiceContainer;

    #comfyUiClient: ComfyUiClient;
    #replyService: IReplyService;

    #logger: ILogger;

    get host(): URL {
        return this.#comfyUiClient.host;
    }

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#comfyUiClient = services.comfyUiClient;
        this.#replyService = services.replyService;

        this.#logger = services.getLogger('ComfyUiReplyService');
    }

    async reply(interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions,
        isEdit: boolean = false,
        renderExchange: IHttpExchange<Array<SerializableRenderRequest | null>, MediaCollectionResponse>): Promise<void> {

        if(reply.content === undefined || reply.content === null) {
            reply.content = '';
        }

        if(reply.files === undefined || reply.files === null) {
            reply.files = [];
        }

        if (Object.values(renderExchange.response).length === 0) {
            this.#logger.error('A reply was created with no attachments.');
            return await this.#replyService.replyWithError(interaction);
        }

        const jsonDescriptions: Array<string | null> = [];

        const isStatefulResponse = renderExchange.request.filter((_, i) => {
            const stringRequest = renderExchange.request[i];

            if(stringRequest !== null) {
                const description = JSON.stringify(stringRequest);
                jsonDescriptions.push(description);
                return description.length <= DiscordConstants.ImageDescriptionMaxLength;
            } else {
                jsonDescriptions.push(null);
                return false;
            }
        }).length === renderExchange.request.length;

        const fileAttachments: Array<AttachmentBuilder> = [];
        let components: ActionRowBuilder<ButtonBuilder>[] = [];

        for (const mediaResponse of Object.values(renderExchange.response)) {
            this.#logger.info(`Attaching render(s):`, mediaResponse);
            let i = 0;

            for (const mediaContainer of mediaResponse) {
                let extension = '';

                const file = Buffer.from(await mediaContainer.blob.arrayBuffer());

                if (mediaContainer.media.filename !== undefined) {
                    extension = mediaContainer.media.filename.substring(
                        mediaContainer.media.filename.lastIndexOf('.'),
                        mediaContainer.media.filename.length);
                } else if (mediaContainer.media['content-type'] !== undefined) {
                    const contentType = mediaContainer.media['content-type'] as string;
                    extension = `.${contentType.substring(contentType.lastIndexOf('/') + 1, contentType.length)}`;
                } else {
                    extension = '.unknown';
                }

                components = isStatefulResponse
                    ? new StatefulAudioGenerationActionRow(this.#services, renderExchange.request[0]).build()
                    : [];

                components = isStatefulResponse ?
                    new StatefulImageGenerationActionRows(this.#services, renderExchange.request[0]).build()
                        .concat(await new Img2ImgActionRow(this.#services).buildAsync()) :
                    new StatelessImageGenerationActionRow(this.#services).build()
                        .concat(await new Img2ImgActionRow(this.#services).buildAsync());

                const filename = this.getFileNameFromPrompt(renderExchange.request[i]
                    || renderExchange.request[0]);

                fileAttachments.push(new AttachmentBuilder(
                    file, {
                    name: `${filename}${extension}`,
                    description: isStatefulResponse
                        ? jsonDescriptions[i] || jsonDescriptions[0]
                        : null,
                    }
                ));

                i++;
            }
        }

        reply.files = reply.files.concat(fileAttachments);
        reply.components = components;

        await this.#replyService.reply(interaction, reply, isEdit);
    }

    getFileNameFromPrompt(renderRequest: SerializableRenderRequest | null): string {
        if(renderRequest === null) {
            return `${APPLICATION_NAME}_${new Date().getTime()}_stateless`;
        }

        return `${APPLICATION_NAME}_${renderRequest.seed}_${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }
}
