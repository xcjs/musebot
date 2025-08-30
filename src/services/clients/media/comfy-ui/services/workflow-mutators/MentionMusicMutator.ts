import { Message } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { getRandomInt } from '../../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { IReplyService } from '../../../../chat/IReplyService.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { IWorkflowMutator } from './IWorkflowMutator.js';

export class MentionMusicMutator implements IWorkflowMutator {
    get interaction(): BotInteraction {
        return BotInteraction.Mention;
    }

    get type(): SupportedFeature {
        return SupportedFeature.Txt2Music;
    }

    #replyService: IReplyService;

    constructor(services: IServiceContainer) {
        this.#replyService = services.replyService;
    }

    async mutate(renderRequest: SerializableRenderRequest, interaction: Message, workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const prompt = this.#replyService.getMessageWithoutBotMentions(interaction);

        // Music models can contain up to two prompts - one for music
        // genre/style and one for lyrics.
        const promptSeparator = '\n\n';

        if(prompt.indexOf(promptSeparator) > 0) {
            renderRequest.prompt = prompt.split(promptSeparator)[0].trim();
            renderRequest.prompt2 = prompt.substring(
                prompt.indexOf(promptSeparator), prompt.length).trim();
        } else {
            renderRequest.prompt = prompt;
        }

        if(renderRequest.durationMin !== undefined
            && renderRequest.durationMax !== undefined) {
            renderRequest.duration = getRandomInt(renderRequest.durationMin, renderRequest.durationMax);
        }

        renderRequest.workflow = workflow.name;
        renderRequest.prompt = prompt;
        renderRequest.num = 1;
        renderRequest.refreshSeed();

        return await Promise.resolve(renderRequest);
    }
}
