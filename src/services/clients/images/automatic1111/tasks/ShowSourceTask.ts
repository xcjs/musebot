import { AttachmentBuilder, ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { Automatic1111ReplyService } from '../../../chat/discord/automatic1111/Automatic1111ReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IShowSourceTask } from '../../tasks/IShowSourceTask.js';

export class ShowSourceTask extends BaseTask implements IShowSourceTask {
    #environmentSettings: IEnvironmentSettings;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #replyService: IReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return 'Discord';
    }

    constructor(
        services: IServiceContainer,
        interaction: ButtonInteraction) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#automatic1111ReplyService = services.automatic1111ReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ShowSourceTask');
    }

    override async process(): Promise<void> {
        const imageAttachment = this.#replyService.getImageAttachments(this.#interaction)[0];
        const jsonRequest = imageAttachment.description;
        const renderRequest = SerializableRenderRequest.fromJson(jsonRequest);

        const jsonBuffer = Buffer.from(jsonRequest, BufferEncoding.UTF8);
        const jsonAttachment = new AttachmentBuilder(jsonBuffer, {
            name: `${this.#automatic1111ReplyService.getFileNameFromPrompt(renderRequest)}.json`
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
