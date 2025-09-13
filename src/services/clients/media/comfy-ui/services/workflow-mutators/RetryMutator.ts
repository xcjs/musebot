import { ButtonInteraction } from 'discord.js';

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

    #workflowService: IWorkflowService;

    constructor(services: IServiceContainer) {
        this.#workflowService = services.workflowService;
    }

    // Method signature required for interface.
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

        return await Promise.resolve(mutatedRequest);
    }
}
