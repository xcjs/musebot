import { Attachment, AttachmentBuilder, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from "../../../../../IBotServiceContainer.js"
import { IReplyService } from '../../../../chat/IReplyService.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { IWorkflowMutator } from './IWorkflowMutator.js';

export class ContextualMediaMutator implements IWorkflowMutator {
    get interactions(): BotInteraction[] {
        return [
            BotInteraction.ContextualReply,
            BotInteraction.ImageMessage,
            BotInteraction.ImageMessageWithPrompt
        ];
    }

    get types(): SupportedFeature[] {
        return [SupportedFeature.ContextualImg2Img];
    }

    get contentMessage(): string {
        return this.#contentMessage;
    }

    get additionalAttachments(): AttachmentBuilder[] {
        return [];
    }

    #replyService: IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

    #contentMessage = '';

    constructor(services: IBotServiceContainer) {
        this.#replyService = services.getReplyService();
    }

    async mutate(renderRequest: SerializableRenderRequest, interaction: Message, workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const prompt = this.#replyService.getMessageWithoutBotMentions(interaction);
        const userMention = `${interaction.member?.user.toString() || 'You'}`;

        if(prompt.length > 0) {
            this.#contentMessage = `${userMention} edited an image by instructing \`${prompt}\``;
        }

        renderRequest.workflow = workflow.name;
        renderRequest.prompt = prompt;
        renderRequest.num = 1;
        renderRequest.refreshSeed();

        return await Promise.resolve(renderRequest);
    }
}
