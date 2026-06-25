import { Attachment, AttachmentBuilder, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { ResourceType } from '../../../../parallelization/ResourceType.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
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

        const renderRequests = await this.#readRenderRequests();
        let messageContent = '';
        const jsonAttachments: AttachmentBuilder[] = [];

        for (const renderRequest of renderRequests) {
            const jsonRequest = renderRequest.toString();

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

    async #readRenderRequests(): Promise<SerializableRenderRequest[]> {
        // Prefer the dedicated state JSON file attachment.
        const stateAttachments = this.#replyService.getAttachmentsByName(this.#interaction, DiscordConstants.StateFileName);

        if (stateAttachments.length > 0) {
            const stateAttachment = stateAttachments[0];
            const response = await fetch(stateAttachment.url);
            const buffer = Buffer.from(await response.arrayBuffer());
            const json = buffer.toString('utf-8');
            const parsed = JSON.parse(json) as SerializableRenderRequest[];

            return parsed.map(item => SerializableRenderRequest.fromSerializableRenderRequest(item));
        }

        // Legacy fallback: read SerializableRenderRequest from media attachment descriptions.
        const imageAttachments = this.#replyService.getMediaAttachments(this.#interaction);
        const renderRequests: SerializableRenderRequest[] = [];

        for (const imageAttachment of imageAttachments) {
            const jsonRequest = imageAttachment.description;

            if (jsonRequest === null) {
                continue;
            }

            renderRequests.push(SerializableRenderRequest.fromJson(jsonRequest));
        }

        if (renderRequests.length === 0) {
            throw new Error('JSON request could not be read from state file or attachment descriptions.');
        }

        return renderRequests;
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
