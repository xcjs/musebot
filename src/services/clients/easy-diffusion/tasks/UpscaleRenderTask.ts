import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { ContentType } from '../../../../enums/ContentType.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';
import { DiscordConstants } from '../../discord/enums/DiscordConstants.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { UpscaledRenderRequest } from '../models/requests/UpscaledRenderRequest.js';
import { MessageService } from '../../discord/services/MessageService.js';

export class UpscaleRenderTask extends BaseTask {
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #messageService: MessageService;
    #replyService: ReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `EasyDiffusion_${this.#easyDiffusionReplyService.easyDiffusionHost}`;
    }

    constructor(
        environmentSettings: EnvironmentSettings,
        easyDiffusionReplyService: EasyDiffusionReplyService,
        messageService: MessageService,
        replyService: ReplyService,
        interaction: ButtonInteraction) {
        super(environmentSettings.maxTaskAttempts);

        this.#easyDiffusionReplyService = easyDiffusionReplyService;
        this.#messageService = messageService;
        this.#replyService = replyService;
        this.#interaction = interaction;

        this.#logger = new Logger(environmentSettings.isProduction, 'UpscaleRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing an UpscaleRenderTask.');

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#messageService.getAttachmentsByType(this.#interaction, imageTypes)[0];

        let request: RenderRequest = null;

        if(imageAttachment?.description) {
            request = UpscaledRenderRequest.FromRenderRequest(RenderRequest.fromJson(imageAttachment.description));
        }

        const renderData = await this.#easyDiffusionReplyService.renderImage(request);
        const content = `${this.#interaction.member} upscaled \`${request.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);
        await this.#easyDiffusionReplyService.reply(this.#interaction, renderData, content);
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Failed) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
