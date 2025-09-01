import { ButtonInteraction } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
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

    constructor() {

    }

    // Method signature required for interface.
    async mutate(renderRequest: SerializableRenderRequest,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        interaction: ButtonInteraction,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        workflow: IWorkflow): Promise<SerializableRenderRequest> {
            renderRequest.refreshSeed();
            renderRequest.refreshDuration();
            return await Promise.resolve(renderRequest);
    }
}
