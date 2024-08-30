import { ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { Txt2ImgOptions } from '@lancercomet/sd-api';

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
import { EasyDiffusionGuidanceScaleLimit } from '../../../easy-diffusion/enums/EasyDiffusionGuidanceScaleLimit.js';
import { UpscaleButton } from '../buttons/UpscaleButton.js';
import { ExpandPromptButton } from '../buttons/ExpandPromptButton.js';
import { StableDiffusionGuidanceScaleLimit } from '../../../automatic1111/enums/StableDiffusionGuidanceScaleLimit.js';

export class StatefulImageGenerationActionRows extends BaseComponent<Array<ActionRowBuilder<ButtonBuilder>>> {
    #environmentSettings: EnvironmentSettings;
    #renderRequest: RenderRequest | Txt2ImgOptions;

    constructor(environmentSettings: EnvironmentSettings, featureService: FeatureService, renderRequest: RenderRequest | Txt2ImgOptions) {
        super(featureService);
        this.#environmentSettings = environmentSettings;
        this.#renderRequest = renderRequest;
    }

    override build(): Array<ActionRowBuilder<ButtonBuilder>> {
        const actionRows: Array<ActionRowBuilder<ButtonBuilder>> = [];

        const retryButton = new RetryButton(this.featureService).build();
        const showSourceButton = new ShowSourceButton(this.featureService).build();
        const upscaleButton = new UpscaleButton(this.featureService).build();

        const mainActionRowBuilder = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(retryButton, upscaleButton, showSourceButton);

        if(this.#renderRequest instanceof RenderRequest) {
            if(this.#renderRequest.guidance_scale - this.#environmentSettings.stableDiffusionGuidanceScaleInterval > EasyDiffusionGuidanceScaleLimit.Min) {
                const guidanceScaleMinusButton = new GuidanceScaleMinusButton(this.featureService).build();
                mainActionRowBuilder.addComponents(guidanceScaleMinusButton);
            }

            if(this.#renderRequest.guidance_scale + this.#environmentSettings.stableDiffusionGuidanceScaleInterval <= EasyDiffusionGuidanceScaleLimit.Max) {
                const guidanceScalePlusButton = new GuidanceScalePlusButton(this.featureService).build();
                mainActionRowBuilder.addComponents(guidanceScalePlusButton);
            }
        } else {
            if(this.#renderRequest.cfg_scale || 0 - this.#environmentSettings.stableDiffusionGuidanceScaleInterval > StableDiffusionGuidanceScaleLimit.Min) {
                const guidanceScaleMinusButton = new GuidanceScaleMinusButton(this.featureService).build();
                mainActionRowBuilder.addComponents(guidanceScaleMinusButton);
            }

            if(this.#renderRequest.cfg_scale || 0 + this.#environmentSettings.stableDiffusionGuidanceScaleInterval <= StableDiffusionGuidanceScaleLimit.Max) {
                const guidanceScalePlusButton = new GuidanceScalePlusButton(this.featureService).build();
                mainActionRowBuilder.addComponents(guidanceScalePlusButton);
            }
        }

        actionRows.push(mainActionRowBuilder);

        if(this.featureService.hasFeature(SupportedFeature.ImagesAndText)) {
            const expandPromptButton = new ExpandPromptButton(this.featureService).build();
            const randomizeButton = new RandomizeButton(this.featureService).build();

            const secondaryActionRowBuilder = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(expandPromptButton, randomizeButton);

            actionRows.push(secondaryActionRowBuilder);
        }

        return actionRows;
    }
}
