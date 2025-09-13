import { ButtonInteraction } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { IEnvironmentSettings } from '../../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { guidanceScaleMax, guidanceScaleMin } from '../../../stable-diffusion/constants/constants.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { IWorkflowMutator } from './IWorkflowMutator.js';

export class GuidanceScaleMutator implements IWorkflowMutator {
    get interactions(): BotInteraction[] {
        return [
            BotInteraction.GuidanceScaleMinus,
            BotInteraction.GuidanceScalePlus,
        ];
    }

    get types(): SupportedFeature[] {
        return [
            SupportedFeature.Txt2Audio,
            SupportedFeature.Txt2Img,
            SupportedFeature.Txt2Music,
            SupportedFeature.Txt2Vid
        ];
    }

    #environmentSettings: IEnvironmentSettings;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;
    }

    // Method signature required for interface.
    async mutate(renderRequest: SerializableRenderRequest,
        interaction: ButtonInteraction,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const mutatedRequest = SerializableRenderRequest.fromSerializableRenderRequest(renderRequest);

        switch(interaction.customId as BotInteraction) {
            case BotInteraction.GuidanceScaleMinus:
                const lowerScale = mutatedRequest.cfgScale -= this.#environmentSettings.stableDiffusionGuidanceScaleInterval;
                mutatedRequest.cfgScale = lowerScale >= guidanceScaleMin ? lowerScale : mutatedRequest.cfgScale;
                break;
            case BotInteraction.GuidanceScalePlus:
                const higherScale = mutatedRequest.cfgScale += this.#environmentSettings.stableDiffusionGuidanceScaleInterval;
                mutatedRequest.cfgScale = higherScale <= guidanceScaleMax ? higherScale : mutatedRequest.cfgScale;
                break;
            default:
                throw new Error('Invalid interaction for GuidanceScaleMutator.');
        }

        return await Promise.resolve(mutatedRequest);
    }
}
