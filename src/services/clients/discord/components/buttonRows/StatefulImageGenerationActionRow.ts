import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { BaseComponent } from '../BaseComponent.js';
import { RandomizeButton } from '../buttons/RandomizeButton.js';
import { RetryButton } from '../buttons/RetryButton.js';
import { GuidanceScaleMinusButton } from '../buttons/GuidanceScaleMinusButton.js';
import { GuidanceScalePlusButton } from '../buttons/GuidanceScalePlusButton.js';
import { ShowSourceButton } from '../buttons/ShowSourceButton.js';
import { FeatureService } from '../../../../features/FeatureService.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { EnvironmentSettings } from '../../../../EnvironmentSettings.js';
import { RenderRequest } from '../../../easy-diffusion/models/requests/RenderRequest.js';
import { StableDiffusionGuidanceScaleLimit } from '../../../easy-diffusion/enums/StableDiffusionGuidanceScaleLimit.js';

export class StatefulImageGenerationActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>> {
    #environmentSettings: EnvironmentSettings;
    #renderRequest: RenderRequest;

    constructor(environmentSettings: EnvironmentSettings, featureService: FeatureService, renderRequest: RenderRequest) {
        super(featureService);
        this.#environmentSettings = environmentSettings;
        this.#renderRequest = renderRequest;
    }

    override build(): ActionRowBuilder<ButtonBuilder> {
        const retryButton = new RetryButton(this.featureService).build();
        const showSourceButton = new ShowSourceButton(this.featureService).build();

        const actionRowBuilder = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(retryButton, showSourceButton);

        if(this.#renderRequest.guidance_scale - this.#environmentSettings.easyDiffusionGuidanceScaleInterval > StableDiffusionGuidanceScaleLimit.Min) {
            const guidanceScaleMinusButton = new GuidanceScaleMinusButton(this.featureService).build();
            actionRowBuilder.addComponents(guidanceScaleMinusButton);
        }

        if(this.#renderRequest.guidance_scale + this.#environmentSettings.easyDiffusionGuidanceScaleInterval <= StableDiffusionGuidanceScaleLimit.Max) {
            const guidanceScalePlusButton = new GuidanceScalePlusButton(this.featureService).build();
            actionRowBuilder.addComponents(guidanceScalePlusButton);
        }

        if(this.featureService.hasFeature(SupportedFeature.RandomImageGeneration)) {
            const randomizeButton = new RandomizeButton(this.featureService).build();
            actionRowBuilder.addComponents(randomizeButton);
        }

        return actionRowBuilder;
    }
}
