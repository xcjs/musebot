import { ImagesResponse, Prompt } from 'comfy-ui-client';
import { AttachmentBuilder, BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { MAX_FILE_NAME_LENGTH } from '../../../../../constants/FileConstants.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ComfyUiClient } from '../../../images/comfy-ui/ComfyUiClient.js';
import { SerializableRenderRequest } from '../../../images/stable-diffusion/models/SerializableRenderRequest.js';
import { IReplyService } from '../../IReplyService.js';
import { StatefulImageGenerationActionRows } from '../components/buttonRows/StatefulImageGenerationActionRows.js';
import { StatelessImageGenerationActionRow } from '../components/buttonRows/StatelessImageGenerationActionRow.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class ComfyUiReplyService {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #comfyUiClient: ComfyUiClient;
    #replyService: IReplyService;

    #logger;

    get host(): URL {
        return this.#comfyUiClient.host;
    }

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#comfyUiClient = services.comfyUiClient;
        this.#replyService = services.replyService;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiReplyService');
    }

    async renderImage(prompt: Prompt): Promise<ImagesResponse> {
        return await this.#comfyUiClient.render([prompt]);
    }

    async reply(interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions,
        isEdit: boolean = false,
        renderExchange: IHttpExchange<Array<SerializableRenderRequest | null>, ImagesResponse>): Promise<void> {

        if(reply.content === undefined || reply.content === null) {
            reply.content = '';
        }

        if(reply.files === undefined || reply.files === null) {
            reply.files = [];
        }

        if (Object.values(renderExchange.response).length === 0) {
            this.#logger(LogLevel.Error, 'A reply was created with no attachments.');
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

        const imageAttachments: Array<AttachmentBuilder> = [];

        for (const imageResponse of Object.values(renderExchange.response)) {
            this.#logger(LogLevel.Info, `Attaching render(s):`, JSON.stringify(imageResponse));
            let i = 0;

            for (const imageContainer of imageResponse) {
                const image = Buffer.from(await imageContainer.blob.arrayBuffer());
                const filename = this.getFileNameFromPrompt(renderExchange.request[i]
                    || renderExchange.request[0]);

                let extension = '';

                if (imageContainer.image.filename !== undefined) {
                    extension = imageContainer.image.filename.substring(
                        imageContainer.image.filename.lastIndexOf('.'),
                        imageContainer.image.filename.length);
                } else if(imageContainer.image['content-type'] !== undefined) {
                    const contentType: string = imageContainer.image['content-type'];
                    extension = `.${contentType.substring(contentType.lastIndexOf('/') + 1, contentType.length)}`;
                } else {
                    // If all else fails, it's most likely a PNG image.
                    extension = '.png';
                }

                imageAttachments.push(new AttachmentBuilder(
                    image, {
                        name: `${filename}${extension}`,
                        description: isStatefulResponse
                            ? jsonDescriptions[i] || jsonDescriptions[0]
                            : null,
                    }
                ));

                i++;
            }
        }

        reply.files = reply.files.concat(imageAttachments);
        reply.components = isStatefulResponse ?
                new StatefulImageGenerationActionRows(this.#services, renderExchange.request[0]).build() :
                new StatelessImageGenerationActionRow(this.#services).build();

        this.#replyService.reply(interaction, reply, isEdit);
    }

    getFileNameFromPrompt(renderRequest: SerializableRenderRequest | null): string {
        const namePrefix = 'Musebot'

        if(renderRequest === null) {
            return `${namePrefix}_${new Date().getTime()}_unnamed`;
        }

        return `${namePrefix}_${renderRequest.seed}_${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }
}
