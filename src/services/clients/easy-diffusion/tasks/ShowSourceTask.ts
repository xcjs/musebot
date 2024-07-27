import { AttachmentBuilder, ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';
import { ContentType } from '../../../../enums/ContentType.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';
import { TaskType } from '../../../tasks/enums/TaskType.js';

export class ShowSourceTask extends BaseTask {
    #easyDiffusionReplyService: EasyDiffusionReplyService;

    #interaction: ButtonInteraction;

    #logger;

    constructor(environmentSettings: EnvironmentSettings,
        easyDiffusionReplyService: EasyDiffusionReplyService,
        interaction: ButtonInteraction) {
        super();

        this.#easyDiffusionReplyService = easyDiffusionReplyService;
        this.#interaction = interaction;

        this.#logger = new Logger(environmentSettings.isProduction, 'ShowSourceTask');

        this._taskType = TaskType.Instant;
    }

    override async process(): Promise<void> {
        this.taskStatus = TaskStatus.Busy;

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#easyDiffusionReplyService.getAttachmentsByType(this.#interaction, imageTypes)[0];
        const jsonRequest = imageAttachment.description;
        const renderRequest = RenderRequest.FromJson(jsonRequest);

        const jsonBuffer = Buffer.from(jsonRequest, BufferEncoding.UTF8);
        const jsonAttachment = new AttachmentBuilder(jsonBuffer, {
            name: `${this.#easyDiffusionReplyService.getFileNameFromPrompt(renderRequest)}.json`
        });

        const messageContent = `${this.#interaction.member} wanted to see the request message for \`${renderRequest.prompt}\`.`;
        this.#logger(LogLevel.Info, messageContent);

        const reply = {
            content: messageContent,
            files: [jsonAttachment]
        };

        await this.#interaction.editReply(reply);

        this.taskStatus = TaskStatus.Successful;
    }
}
