import { AttachmentBuilder, ButtonInteraction } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { IConfigurationService } from '../../../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from "../../../../../IBotServiceContainer.js"
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

    get contentMessage(): string {
        return this.#contentMessage;
    }

    get additionalAttachments(): AttachmentBuilder[] {
        return [];
    }

    #configurationService: IConfigurationService;

    #contentMessage = '';

    constructor(services: IBotServiceContainer) {
        this.#configurationService = services.configurationService;
    }

    // Method signature required for interface.
    async mutate(renderRequest: SerializableRenderRequest,
        interaction: ButtonInteraction,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const mutatedRequest = SerializableRenderRequest.fromSerializableRenderRequest(renderRequest);

        switch(interaction.customId as BotInteraction) {
            case BotInteraction.GuidanceScaleMinus:
                const lowerScale = mutatedRequest.cfgScale -= this.#configurationService.comfyUiGuidanceScaleInterval;
                mutatedRequest.cfgScale = lowerScale >= guidanceScaleMin ? lowerScale : mutatedRequest.cfgScale;

                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                this.#contentMessage = this.#contentMessage = `${interaction.member?.user.toString() || 'You'} decreased the guidance scale from \`${renderRequest.cfgScale}\` to \`${ mutatedRequest.cfgScale }\`.`
                break;
            case BotInteraction.GuidanceScalePlus:
                const higherScale = mutatedRequest.cfgScale += this.#configurationService.comfyUiGuidanceScaleInterval;
                mutatedRequest.cfgScale = higherScale <= guidanceScaleMax ? higherScale : mutatedRequest.cfgScale;

                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                this.#contentMessage = this.#contentMessage = `${interaction.member?.user.toString() || 'You'} increased the guidance scale from \`${renderRequest.cfgScale}\` to \`${mutatedRequest.cfgScale}\`.`
                break;
            default:
                throw new Error('Invalid interaction for GuidanceScaleMutator.');
        }

        return await Promise.resolve(mutatedRequest);
    }
}
