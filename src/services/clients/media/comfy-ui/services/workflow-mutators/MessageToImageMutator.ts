import { Message, MessageType } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { IReplyService } from '../../../../chat/IReplyService.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { IWorkflowMutator } from './IWorkflowMutator.js';

export class MessageToImageMutator implements IWorkflowMutator {
    get interactions(): BotInteraction[] {
        return [BotInteraction.Message];
    }

    get types(): SupportedFeature[] {
        return [SupportedFeature.Txt2Img];
    }

    #replyService: IReplyService;

    constructor(services: IServiceContainer) {
        this.#replyService = services.replyService;
    }

    async mutate(renderRequest: SerializableRenderRequest, interaction: Message, workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const prompt = interaction.type === MessageType.Reply
            ? `${((await this.#replyService.getAllAntecedentPrompts(interaction)).join('\n\n'))} ${interaction.content}`.trim()
            : this.#replyService.getMessageWithoutBotMentions(interaction);

        renderRequest.workflow = workflow.name;
        renderRequest.prompt = prompt;
        renderRequest.num = 1;
        renderRequest.refreshSeed();

        return renderRequest;
    }
}
