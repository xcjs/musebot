import { ActionRowBuilder, AttachmentBuilder, BaseMessageOptions, ButtonBuilder, ButtonInteraction, Message } from 'discord.js';

import { MAX_FILE_NAME_LENGTH } from '../../../../../constants/FileConstants.js';
import { APPLICATION_NAME } from '../../../../../constants/Globals.js';
import { ContentType } from '../../../../../enums/ContentType.js';
import { ContentTypeCategory } from '../../../../../enums/ContentTypeCategory.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IContentTypeService } from '../../../../features/IContentTypeService.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ComfyUiClient } from '../../../media/comfy-ui/ComfyUiClient.js';
import { MediaCollectionResponse, MediaContainer } from '../../../media/comfy-ui/extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../../../media/stable-diffusion/models/SerializableRenderRequest.js';
import { IReplyService } from '../../IReplyService.js';
import { Img2ImgActionRow } from '../components/buttonRows/Img2ImgActionRow.js';
import { StatefulAudioGenerationActionRow } from '../components/buttonRows/StatefulAudioGenerationActionRow.js';
import { StatefulImageGenerationActionRows } from '../components/buttonRows/StatefulImageGenerationActionRows.js';
import { StatelessImageGenerationActionRow } from '../components/buttonRows/StatelessImageGenerationActionRow.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class ComfyUiReplyService {
    #services: IServiceContainer;

    #contentTypeService: IContentTypeService;
    #comfyUiClient: ComfyUiClient;
    #replyService: IReplyService;

    #logger: ILogger;

    get host(): URL {
        return this.#comfyUiClient.host;
    }

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#contentTypeService = services.contentTypeService;
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

        const jsonDescriptions: string[] = renderExchange.request.map((request) => {
            const requestString = JSON.stringify(request);
            return requestString.length <= DiscordConstants.ContentMaxLength
                ? requestString
                : '';
        });

        const fileAttachments: AttachmentBuilder[] = [];
        let components: ActionRowBuilder<ButtonBuilder>[] = [];

        for (const mediaContainerCollection of Object.values(renderExchange.response)) {
            this.#logger.info(`Attaching render(s):`, mediaContainerCollection);
            let i = 0;

            for (const mediaContainer of mediaContainerCollection) {
                let extension = '';

                const file = Buffer.from(await mediaContainer.blob.arrayBuffer());

                if (mediaContainer.media.filename !== undefined) {
                    extension = mediaContainer.media.filename.substring(
                        mediaContainer.media.filename.lastIndexOf('.'),
                        mediaContainer.media.filename.length);
                } else if (mediaContainer.blob.type !== undefined) {
                    const contentType = mediaContainer.blob.type;
                    extension = `.${contentType.substring(contentType.lastIndexOf('/') + 1, contentType.length)}`;
                } else {
                    extension = '.octet';
                }

                // Allow the action bar to be set from the first piece of media content.
                if(components.length === 0) {
                    components = await this.#buildActionBars(mediaContainer, renderExchange.request);
                }

                const filename = this.getFileNameFromPrompt(renderExchange.request[i]
                    || renderExchange.request[0]);

                fileAttachments.push(new AttachmentBuilder(
                    file, {
                    name: `${filename}${extension}`,
                    description: jsonDescriptions[i] || jsonDescriptions[0]
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

    async #buildActionBars(mediaContainer: MediaContainer, requests: SerializableRenderRequest[]): Promise<ActionRowBuilder<ButtonBuilder>[]> {
        if (mediaContainer === null) {
            return [];
        }

        const contentType = mediaContainer.blob.type as ContentType;
        const contentTypeCategory = this.#contentTypeService.getContentTypeCategoryFromContentType(contentType);

        const isStatefulResponse = requests.filter((request) => {
            if (request !== null) {
                const description = JSON.stringify(request);
                return description.length <= DiscordConstants.ImageDescriptionMaxLength;
            } else {
                return false;
            }
        }).length === requests.length;

        switch(contentTypeCategory) {
            case ContentTypeCategory.Audio:
                return isStatefulResponse
                    ? new StatefulAudioGenerationActionRow(this.#services, requests[0]).build()
                    : [];
            case ContentTypeCategory.Image:
                return isStatefulResponse ?
                    new StatefulImageGenerationActionRows(this.#services, requests[0]).build()
                        .concat(await new Img2ImgActionRow(this.#services).buildAsync()) :
                    new StatelessImageGenerationActionRow(this.#services).build()
                        .concat(await new Img2ImgActionRow(this.#services).buildAsync());
            default:
                return [];
        }
    }
}
