import { Message, MessageType } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { IReplyService } from '../../../../chat/IReplyService.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { IRenderRequestMutator } from './IRenderRequestMutator.js';

export class NewImagePromptMutator implements IRenderRequestMutator
 {
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
