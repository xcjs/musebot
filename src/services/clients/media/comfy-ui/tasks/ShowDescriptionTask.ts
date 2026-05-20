import { Attachment, AttachmentBuilder, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { IBotServiceContainer } from "../../../../IServiceContainer.js"
import { ResourceType } from '../../../../parallelization/ResourceType.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';

type DiscordReplyService = IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';

export class ShowDescriptionTask extends BaseTask<void> {
    readonly #comfyUiReplyService: ComfyUiReplyService;
    readonly #replyService: DiscordReplyService;

    readonly #interaction: ButtonInteraction;

    override get taskChannel(): string {
        return this.parallelizationStrategy.getTaskChannel(ResourceType.Chat, this.isChild, null);
    }

    constructor(services: IBotServiceContainer, interaction: ButtonInteraction) {
        super(services);
        this.logger = services.getLogger('ShowDescriptionTask');

        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.getReplyService();

        this.#interaction = interaction;
    }

    override async process(): Promise<void> {
        await super.process();

        const imageAttachments = this.#replyService.getImageAttachments(this.#interaction);
        let messageContent: string = '';
        const jsonAttachments: AttachmentBuilder[] = [];

        for(const imageAttachment of imageAttachments) {
            const jsonRequest = imageAttachment.description;

            if(jsonRequest === null) {
                throw new Error('JSON request could not be read from attachment description.');
            }

            const renderRequest = SerializableRenderRequest.fromJson(jsonRequest);

            const jsonBuffer = Buffer.from(jsonRequest, BufferEncoding.UTF8);
            jsonAttachments.push(new AttachmentBuilder(jsonBuffer, {
                name: `${this.#comfyUiReplyService.getFileNameFromPrompt(renderRequest)}.json`
            }));

            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            messageContent = `${this.#interaction.member?.user.toString() || 'You'} wanted to see the request message for \`${renderRequest.prompt}\``;
        }

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
