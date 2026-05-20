import { Attachment, AttachmentBuilder, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from "../../../../../IServiceContainer.js"
import { DiscordConstants } from '../../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../../chat/IReplyService.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { IWorkflowMutator } from './IWorkflowMutator.js';

export class JsonMutator implements IWorkflowMutator {
    get interactions(): BotInteraction[] {
        return [BotInteraction.JsonMessage];
    }

    get types(): SupportedFeature[] {
        return [
            SupportedFeature.Txt2Audio,
            SupportedFeature.Txt2Img,
            SupportedFeature.Txt2Music,
            SupportedFeature.Txt2Vid
        ];
    }

    get contentMessage(): string {
        return '';
    }

    get additionalAttachments(): AttachmentBuilder[] {
        return [];
    }

    #replyService: IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

    constructor(services: IBotServiceContainer) {
        this.#replyService = services.getReplyService();
    }

    // The parameters are required by the interface.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async mutate(renderRequest: SerializableRenderRequest, interaction: Message, workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const prompt = this.#replyService.getMessageWithoutBotMentions(interaction);

        let mutatedRequest: SerializableRenderRequest;

        try {
            mutatedRequest = SerializableRenderRequest.fromJson(prompt);
        } catch {
            await interaction.reply('You call that JSON? My grandmother could knit better JSON.');
            return null;
        }

        mutatedRequest.height = Math.ceil(mutatedRequest.height);
        mutatedRequest.width = Math.ceil(mutatedRequest.width);

        if (mutatedRequest.seed === -1) {
            mutatedRequest.refreshSeed();
        }

        if (mutatedRequest.num > DiscordConstants.MaxAttachmentsPerMessage) {
            mutatedRequest.num = DiscordConstants.MaxAttachmentsPerMessage;
        }

        return mutatedRequest;
    }
}
