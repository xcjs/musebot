import { AttachmentBuilder, ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from 'services/tasks/models/BaseTask.js';
import { TaskStatus } from 'services/tasks/enums/TaskStatus.js';
import { BufferEncoding } from 'enums/BufferEncoding.js';
import { ContentType } from 'enums/ContentType.js';
import { ReplyService } from 'services/clients/chat/discord/ReplyService.js';
import { MessageService } from 'services/clients/chat/discord/MessageService.js';
import { SerializableRenderRequest } from 'services/clients/images/stable-diffusion/models/SerializableRenderRequest.js';
import { Automatic1111ReplyService } from 'services/clients/chat/discord/automatic1111/Automatic1111ReplyService.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings.js';

export class ShowSourceTask extends BaseTask {
    #environmentSettings: IEnvironmentSettings;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #messageService: MessageService;
    #replyService: ReplyService;

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
        this.#messageService = services.messageService;
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
