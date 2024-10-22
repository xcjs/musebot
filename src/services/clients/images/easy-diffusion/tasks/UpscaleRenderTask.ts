import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { ContentType } from '../../../../../enums/ContentType.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { EasyDiffusionReplyService } from '../../../chat/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IUpscaleRenderTask } from '../../tasks/IUpscaleRenderTask.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';
import { UpscaledRenderRequest } from '../models/requests/UpscaledRenderRequest.js';

export class UpscaleRenderTask extends BaseTask implements IUpscaleRenderTask {
    #environmentSettings: IEnvironmentSettings;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #replyService: IReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `EasyDiffusion_${this.#easyDiffusionReplyService.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#easyDiffusionReplyService = services.easyDiffusionReplyService;
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

        const imageAttachment = this.#replyService.getAttachmentsByType(this.#interaction, imageTypes)[0];

        let request: RenderRequest = null;

        if(imageAttachment?.description) {
            request = UpscaledRenderRequest.FromRenderRequest(RenderRequest.fromJson(imageAttachment.description));
        }

        const renderData = await this.#easyDiffusionReplyService.renderImage(request);
        const content = `${this.#interaction.member} upscaled \`${request.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);
        await this.#easyDiffusionReplyService.reply(this.#interaction, renderData, content);
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
