import { ImagesResponse, Prompt } from 'comfy-ui-client';
import { AttachmentBuilder, BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { MAX_FILE_NAME_LENGTH } from '../../../../../constants/FileConstants.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { Txt2ImgOptionsRequest } from '../../../images/automatic1111/models/requests/Txt2ImgOptionsRequest.js';
import { ComfyUiClient } from '../../../images/comfy-ui/ComfyUiClient.js';
import { SerializableRenderRequest } from '../../../images/stable-diffusion/models/SerializableRenderRequest.js';
import { StatefulImageGenerationActionRows } from '../components/buttonRows/StatefulImageGenerationActionRows.js';
import { StatelessImageGenerationActionRow } from '../components/buttonRows/StatelessImageGenerationActionRow.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class ComfyUiReplyService {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #comfyUiClient: ComfyUiClient;

    #logger;

    get host(): URL {
        return this.#comfyUiClient.host;
    }

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#comfyUiClient = services.comfyUiClient;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiReplyService');
    }

    async renderImage(prompt: Prompt): Promise<ImagesResponse> {
        return await this.#comfyUiClient.render(prompt);
    }

    async reply(interaction: Message | ButtonInteraction,
        renderExchange: IHttpExchange<SerializableRenderRequest, ImagesResponse>,
        content: string | null = null,
        additionalAttachments: Array<AttachmentBuilder> | null = null,
        isEdit: boolean = false): Promise<void> {

        const description = JSON.stringify(renderExchange.request);
        const isStatefulResponse = description.length <= DiscordConstants.ImageDescriptionMaxLength;

        const imageAttachments: Array<AttachmentBuilder> = [];

        this.#logger(LogLevel.Info, `Attaching render(s):`, description);

        for(const imageResponse of Object.values(renderExchange.response)) {
            for (const imageContainer of imageResponse) {
                const image = Buffer.from(await imageContainer.blob.arrayBuffer());
                const filename = this.getFileNameFromPrompt(renderExchange.request);

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
                            ? description
                            : null,

                    }
                ));
            }
        }

        let files = imageAttachments;

        if (additionalAttachments) {
            files = imageAttachments.concat(additionalAttachments);
        }

        const reply: BaseMessageOptions = {
            content,
            files,
            components: isStatefulResponse ?
                new StatefulImageGenerationActionRows(this.#services, renderExchange.request).build() :
                new StatelessImageGenerationActionRow(this.#services).build()
        };

        if (interaction instanceof Message) {
            if (isEdit) {
                reply.components = interaction.components;
                await interaction.edit(reply);
            } else {
                await interaction.reply(reply);
            }
        } else if (interaction instanceof ButtonInteraction) {
            await interaction.editReply(reply);
        }
    }

    getFileNameFromPrompt(renderRequest: Txt2ImgOptionsRequest | SerializableRenderRequest): string {
        return `${renderRequest.seed}_${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }

    flattenMultipleImagesResponses(imagesResponses: Array<ImagesResponse>): ImagesResponse {
        const imagesResponse: ImagesResponse = { };

        for (const imageResponse in imagesResponses) {
            for (const [key, value] of Object.entries(imagesResponses)) {
                if (imageResponse[key] === undefined) {
                    imageResponse[key] = [];
                }

                imageResponse[key] = value;
            }
        }

        return imagesResponse;
    }
}
