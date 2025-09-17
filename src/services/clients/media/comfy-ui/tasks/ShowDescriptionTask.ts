import { AttachmentBuilder, ButtonInteraction } from 'discord.js';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';

export class ShowDescriptionTask extends BaseTask<void> {
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #logger: ILogger;

    #interaction: ButtonInteraction;

    override get taskChannel(): string {
        return 'Discord';
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#logger = services.getLogger('ShowDescriptionTask');

        this.#interaction = interaction;
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ShowDescriptionTask...');

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

            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            messageContent = `${this.#interaction.member?.user.toString() || 'You'} wanted to see the request message for \`${renderRequest.prompt}\``;
        }

        this.#logger.info(messageContent);

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
