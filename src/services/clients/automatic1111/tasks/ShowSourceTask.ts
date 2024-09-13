import { AttachmentBuilder, ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';
import { ContentType } from '../../../../enums/ContentType.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { MessageService } from '../../discord/services/MessageService.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { Automatic1111ReplyService } from '../../discord/automatic1111/Automatic1111ReplyService.js';

export class ShowSourceTask extends BaseTask {
    #automatic1111ReplyService: Automatic1111ReplyService;
    #messageService: MessageService;
    #replyService: ReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return 'Discord';
    }

    constructor(environmentSettings: EnvironmentSettings,
        automatic1111ReplyService: Automatic1111ReplyService,
        messageService: MessageService,
        replyService: ReplyService,
        interaction: ButtonInteraction) {
        super(environmentSettings.maxTaskAttempts);

        this.#automatic1111ReplyService = automatic1111ReplyService;
        this.#messageService = messageService;
        this.#replyService = replyService;
        this.#interaction = interaction;

        this.#logger = new Logger(environmentSettings.isProduction, 'ShowSourceTask');
    }

    override async process(): Promise<void> {
        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#messageService.getAttachmentsByType(this.#interaction, imageTypes)[0];
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
