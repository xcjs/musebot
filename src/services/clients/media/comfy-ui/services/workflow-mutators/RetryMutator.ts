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
            renderRequest.refreshSeed();
            renderRequest.refreshDuration();

            const workflowDefaults = this.#workflowService.getWorkflowDefaults(workflow);

            if (renderRequest.workflow !== workflow.name
                && renderRequest.width !== undefined
                && renderRequest.height !== undefined
            ) {
                renderRequest.height = workflowDefaults.height;
                renderRequest.width = workflowDefaults.width;
            }

            return await Promise.resolve(renderRequest);
    }
}
