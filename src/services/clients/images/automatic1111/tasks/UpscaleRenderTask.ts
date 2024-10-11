import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from 'services/tasks/models/BaseTask.js';
import { TaskStatus } from 'services/tasks/enums/TaskStatus.js';
import { ContentType } from 'enums/ContentType.js';
import { DiscordConstants } from 'services/clients/chat/discord/enums/DiscordConstants.js';
import { ReplyService } from 'services/clients/chat/discord/ReplyService.js';
import { MessageService } from 'services/clients/chat/discord/MessageService.js';
import { Automatic1111ReplyService } from 'services/clients/chat/discord/automatic1111/Automatic1111ReplyService.js';
import { SerializableRenderRequest } from 'services/clients/images/stable-diffusion/models/SerializableRenderRequest.js';
import { Txt2ImgOptionsRequest } from 'services/clients/images/automatic1111/models/requests/Txt2ImgOptionsRequest.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings.js';

export class UpscaleRenderTask extends BaseTask {
    #environmentSettings: IEnvironmentSettings;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #messageService: MessageService;
    #replyService: ReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `Automatic1111_${this.#automatic1111ReplyService.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#automatic1111ReplyService = services.automatic1111ReplyService;
        this.#messageService = services.messageService;
        this.#replyService = services.replyService;
        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'UpscaleRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing an UpscaleRenderTask.');

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#messageService.getAttachmentsByType(this.#interaction, imageTypes)[0];

        const descriptionRequest = SerializableRenderRequest.fromJson(imageAttachment.description);
        const request: Txt2ImgOptionsRequest = descriptionRequest.toTxt2ImgOptionsRequest();

        const renderData = await this.#automatic1111ReplyService.renderImage(request, descriptionRequest.model);
        const upscaledData = await this.#automatic1111ReplyService.upscaleImage(renderData.exchange.response.images[0]);

        renderData.exchange.response.images = [upscaledData.image];

        const content = `${this.#interaction.member} upscaled \`${request.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);
        await this.#automatic1111ReplyService.reply(this.#interaction, renderData, content);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
