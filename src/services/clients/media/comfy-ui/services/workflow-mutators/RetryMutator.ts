import { AttachmentBuilder, ButtonInteraction } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { IWorkflowService } from '../IWorkflowService.js';
import { IWorkflowMutator } from './IWorkflowMutator.js';

export class RetryMutator implements IWorkflowMutator {
    get interactions(): BotInteraction[] {
        return [BotInteraction.Retry];
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
        return this.#contentMessage;
    }

    get additionalAttachments(): AttachmentBuilder[] {
        return [];
    }

    #workflowService: IWorkflowService;
    #contentMessage = '';

    constructor(services: IServiceContainer) {
        this.#workflowService = services.workflowService;
    }

    async mutate(renderRequest: SerializableRenderRequest,
        interaction: ButtonInteraction,
        workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const mutatedRequest = SerializableRenderRequest.fromSerializableRenderRequest(renderRequest);

        mutatedRequest.refreshSeed();
        mutatedRequest.refreshDuration();

        const workflowDefaults = this.#workflowService.getWorkflowDefaults(workflow);

        if (mutatedRequest.workflow !== workflow.name
            && mutatedRequest.width !== undefined
            && mutatedRequest.height !== undefined
        ) {
            mutatedRequest.height = workflowDefaults.height;
            mutatedRequest.width = workflowDefaults.width;
        }

        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        this.#contentMessage = `${interaction.member?.user.toString() || 'You'} retried \`${mutatedRequest.prompt }\``

        return await Promise.resolve(mutatedRequest);
    }
}
