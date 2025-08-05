import { ImagesResponse } from 'comfy-ui-client';
import { ActionRowBuilder, AttachmentBuilder, BaseMessageOptions, ButtonBuilder, ButtonInteraction, Message } from 'discord.js';

import { MAX_FILE_NAME_LENGTH } from '../../../../../constants/FileConstants.js';
import { APPLICATION_NAME } from '../../../../../constants/Globals.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ComfyUiClient } from '../../../images/comfy-ui/ComfyUiClient.js';
import { MediaContainer, MultiMediaResponse } from '../../../images/comfy-ui/extensions/MediaResponse.js';
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
        renderExchange: IHttpExchange<Array<SerializableRenderRequest | null>, ImagesResponse | MultiMediaResponse>): Promise<void> {

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
                let file: Buffer<ArrayBuffer>;
                let extension = '';

                const audioContainer = (mediaContainer as MediaContainer).audio !== undefined
                    ? (mediaContainer as MediaContainer) : null;

                const imageContainer = mediaContainer;

                if(audioContainer !== null) {
                    file = Buffer.from(await mediaContainer.blob.arrayBuffer());

                    if (audioContainer.audio.filename !== undefined) {
                        extension = audioContainer.audio.filename.substring(
                            audioContainer.audio.filename.lastIndexOf('.'),
                            audioContainer.audio.filename.length);
                    } else if (audioContainer.audio['content-type'] !== undefined) {
                        const contentType = audioContainer.audio['content-type'] as string;
                        extension = `.${contentType.substring(contentType.lastIndexOf('/') + 1, contentType.length)}`;
                    } else {
                        // If all else fails, it's most likely an MP3 sound.
                        extension = '.mp3';
                    }

                    components = isStatefulResponse
                        ? new StatefulAudioGenerationActionRow(this.#services, renderExchange.request[0]).build()
                        : [];
                } else if(imageContainer !== null) {
                    file = Buffer.from(await imageContainer.blob.arrayBuffer());

                    if (imageContainer.image.filename !== undefined) {
                        extension = imageContainer.image.filename.substring(
                            imageContainer.image.filename.lastIndexOf('.'),
                            imageContainer.image.filename.length);
                    } else if (imageContainer.image['content-type'] !== undefined) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        const contentType: string = imageContainer.image['content-type'];
                        extension = `.${contentType.substring(contentType.lastIndexOf('/') + 1, contentType.length)}`;
                    } else {
                        // If all else fails, it's most likely a PNG image.
                        extension = '.png';
                    }

                    components = isStatefulResponse ?
                        new StatefulImageGenerationActionRows(this.#services, renderExchange.request[0]).build()
                            .concat(await new Img2ImgActionRow(this.#services).buildAsync()) :
                        new StatelessImageGenerationActionRow(this.#services).build()
                            .concat(await new Img2ImgActionRow(this.#services).buildAsync());
                } else {
                    throw new Error('An unsupported media container was used.');
                }

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
