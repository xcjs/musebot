import * as toBuffer from 'blob-to-buffer';
import { ImagesResponse } from 'comfy-ui-client';
import { AttachmentBuilder, BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';
import { Logger } from 'meklog';

import { MAX_FILE_NAME_LENGTH } from '../../../../../constants/FileConstants.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { Txt2ImgOptionsRequest } from '../../../images/automatic1111/models/requests/Txt2ImgOptionsRequest.js';
import { ComfyUiClient } from '../../../images/comfy-ui/ComfyUiClient.js';
import { SerializableRenderRequest } from '../../../images/stable-diffusion/models/SerializableRenderRequest.js';

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async renderImage(): Promise<ImagesResponse> {
        // this.#logger(LogLevel.Info, `Render prompt: ${request.prompt}`);

        return await this.#comfyUiClient.render();
    }

    // async upscaleImage(image: string, upscaler: Upscaler): Promise<ExtraSingleImageResponse> {
    //     this.#logger(LogLevel.Info, 'Upscaling an image...');

    //     const request = UpscalerRequestFactory.getUpscaleSettings(image, upscaler);
    //     return await this.#automatic1111Client.upscaleImage(request);
    // }

    async reply(interaction: Message | ButtonInteraction,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderData: ImagesResponse,
        content: string | null = null,
        additionalAttachments: Array<AttachmentBuilder> | null = null,
        isEdit: boolean = false): Promise<void> {

        const image = toBuffer(renderData['13'][0].blob);
        const filename = renderData['13'][0].image.filename;

        const imageAttachment = new AttachmentBuilder(image, {
            name: `${filename}.png`
        });

        let files: Array<AttachmentBuilder> = [imageAttachment];

        if (additionalAttachments) {
            files = files.concat(additionalAttachments);
        }

        const reply: BaseMessageOptions = {
            content,
            files
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
}
