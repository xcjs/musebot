import { AttachmentBuilder, ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';
import { ContentType } from '../../../../enums/ContentType.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { EasyDiffusionReplyService } from '../../chat/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { RenderRequest } from '../../images/easy-diffusion/models/requests/RenderRequest.js';
import { IReplyService } from '../../chat/IReplyService.js';

export class ShowSourceTask extends BaseTask {
    #environmentSettings: IEnvironmentSettings;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #replyService: IReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return 'Discord';
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#easyDiffusionReplyService = services.easyDiffusionReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ShowSourceTask');
    }

    override async process(): Promise<void> {
        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#replyService.getAttachmentsByType(this.#interaction, imageTypes)[0];
        const jsonRequest = imageAttachment.description;
        const renderRequest = RenderRequest.fromJson(jsonRequest);

        const jsonBuffer = Buffer.from(jsonRequest, BufferEncoding.UTF8);
        const jsonAttachment = new AttachmentBuilder(jsonBuffer, {
            name: `${this.#easyDiffusionReplyService.getFileNameFromPrompt(renderRequest)}.json`
        });

        const messageContent = `${this.#interaction.member} wanted to see the request message for \`${renderRequest.prompt}\``;
        this.#logger(LogLevel.Info, messageContent);

        const reply = {
            content: messageContent,
            files: [jsonAttachment]
        };

        await this.#interaction.editReply(reply);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
