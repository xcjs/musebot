import { AttachmentBuilder, ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IShowSourceTask } from '../../tasks/IShowSourceTask.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiShowSourceTask extends ComfyUiBaseTask implements IShowSourceTask {
    #environmentSettings: IEnvironmentSettings;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return 'Discord';
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiShowSourceTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger(LogLevel.Info, 'Processing a ComfyUiShowSourceTask...');

        const imageAttachments = this.#replyService.getImageAttachments(this.#interaction);
        let messageContent: string;
        const jsonAttachments: AttachmentBuilder[] = [];

        for(const imageAttachment of imageAttachments) {
            const jsonRequest = imageAttachment.description;
            const renderRequest = SerializableRenderRequest.fromJson(jsonRequest);

            const jsonBuffer = Buffer.from(jsonRequest, BufferEncoding.UTF8);
            jsonAttachments.push(new AttachmentBuilder(jsonBuffer, {
                name: `${this.#comfyUiReplyService.getFileNameFromPrompt(renderRequest)}.json`
            }));

            messageContent = `${this.#interaction.member} wanted to see the request message for \`${renderRequest.prompt}\``;
        }

        this.#logger(LogLevel.Info, messageContent);

        const reply = {
            content: messageContent,
            files: jsonAttachments
        };

        await this.#interaction.message.reply(reply);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
