import { AttachmentBuilder, Message, MessageType } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { IReplyService } from '../../../../chat/IReplyService.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { IWorkflowMutator } from './IWorkflowMutator.js';

export class MessageToMediaMutator implements IWorkflowMutator {
    get interactions(): BotInteraction[] {
        return [BotInteraction.Message, BotInteraction.Reply];
    }

    get types(): SupportedFeature[] {
        return [
            SupportedFeature.Txt2Audio,
            SupportedFeature.Txt2Img,
            SupportedFeature.Txt2Vid
        ];
    }

    get contentMessage(): string {
        return this.#contentMessage;
    }

    get additionalAttachments(): AttachmentBuilder[] {
        return [];
    }

    #replyService: IReplyService;

    #contentMessage = '';

    constructor(services: IServiceContainer) {
        this.#replyService = services.replyService;
    }

    async mutate(renderRequest: SerializableRenderRequest, interaction: Message, workflow: IWorkflow): Promise<SerializableRenderRequest> {
        let prompt = this.#replyService.getMessageWithoutBotMentions(interaction);
        const userMention = `${interaction.member?.user.toString() || 'You'}`;
        this.#contentMessage = `${userMention} generated \`${prompt}\``;

        if(interaction.type === MessageType.Reply) {
            const previousMessage = await this.#replyService.getPreviousMessage(interaction);

            if(previousMessage !== null) {
                const priorPrompt = this.#replyService.extractPrompt(previousMessage);
                prompt = `${priorPrompt} ${interaction.content}`.trim();
                this.#contentMessage = `${userMention} generated \`${priorPrompt}\` as \`${prompt}\``;
            }
        }

        renderRequest.workflow = workflow.name;
        renderRequest.prompt = prompt;
        renderRequest.num = 1;
        renderRequest.refreshSeed();

        return await Promise.resolve(renderRequest);
    }
}
