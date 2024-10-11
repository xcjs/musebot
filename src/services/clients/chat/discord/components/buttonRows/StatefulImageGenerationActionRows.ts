import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { BaseComponent } from 'services/clients/chat/discord/components/BaseComponent.js';
import { RandomizeButton } from 'services/clients/chat/discord/components/buttons/RandomizeButton.js';
import { RetryButton } from 'services/clients/chat/discord/components/buttons/RetryButton.js';
import { GuidanceScaleMinusButton } from 'services/clients/chat/discord/components/buttons/GuidanceScaleMinusButton.js';
import { GuidanceScalePlusButton } from 'services/clients/chat/discord/components/buttons/GuidanceScalePlusButton.js';
import { ShowSourceButton } from 'services/clients/chat/discord/components/buttons/ShowSourceButton.js';
import { SupportedFeature } from 'services/features/enum/SupportedFeature.js';
import { RenderRequest } from 'services/clients/images/easy-diffusion/models/requests/RenderRequest.js';
import { EasyDiffusionGuidanceScaleLimit } from 'services/clients/images/easy-diffusion/enums/EasyDiffusionGuidanceScaleLimit.js';
import { UpscaleButton } from 'services/clients/chat/discord/components/buttons/UpscaleButton.js';
import { ExpandPromptButton } from '../buttons/ExpandPromptButton.js';
import { StableDiffusionGuidanceScaleLimit } from 'services/clients/images/automatic1111/enums/StableDiffusionGuidanceScaleLimit.js';
import { Txt2ImgOptionsRequest } from 'services/clients/images/automatic1111/models/requests/Txt2ImgOptionsRequest.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings.js';

export class StatefulImageGenerationActionRows extends BaseComponent<Array<ActionRowBuilder<ButtonBuilder>>> {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #renderRequest: RenderRequest | Txt2ImgOptionsRequest;

    constructor(services: IServiceContainer, renderRequest: RenderRequest | Txt2ImgOptionsRequest) {
        super(services);
        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#renderRequest = renderRequest;
    }

    override build(): Array<ActionRowBuilder<ButtonBuilder>> {
        const actionRows: Array<ActionRowBuilder<ButtonBuilder>> = [];

        const retryButton = new RetryButton(this.#services).build();
        const showSourceButton = new ShowSourceButton(this.#services).build();
        const upscaleButton = new UpscaleButton(this.#services).build();

        const mainActionRowBuilder = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(retryButton, upscaleButton, showSourceButton);

        if(this.#renderRequest instanceof RenderRequest) {
            if(this.#renderRequest.guidance_scale - this.#environmentSettings.stableDiffusionGuidanceScaleInterval > EasyDiffusionGuidanceScaleLimit.Min) {
                const guidanceScaleMinusButton = new GuidanceScaleMinusButton(this.#services).build();
                mainActionRowBuilder.addComponents(guidanceScaleMinusButton);
            }

            if(this.#renderRequest.guidance_scale + this.#environmentSettings.stableDiffusionGuidanceScaleInterval <= EasyDiffusionGuidanceScaleLimit.Max) {
                const guidanceScalePlusButton = new GuidanceScalePlusButton(this.#services).build();
                mainActionRowBuilder.addComponents(guidanceScalePlusButton);
            }
        } else {
            if(this.#renderRequest.cfg_scale || 0 - this.#environmentSettings.stableDiffusionGuidanceScaleInterval > StableDiffusionGuidanceScaleLimit.Min) {
                const guidanceScaleMinusButton = new GuidanceScaleMinusButton(this.#services).build();
                mainActionRowBuilder.addComponents(guidanceScaleMinusButton);
            }

            if(this.#renderRequest.cfg_scale || 0 + this.#environmentSettings.stableDiffusionGuidanceScaleInterval <= StableDiffusionGuidanceScaleLimit.Max) {
                const guidanceScalePlusButton = new GuidanceScalePlusButton(this.#services).build();
                mainActionRowBuilder.addComponents(guidanceScalePlusButton);
            }
        }

        actionRows.push(mainActionRowBuilder);

        if(this.featureService.hasFeature(SupportedFeature.ImagesAndText)) {
            const expandPromptButton = new ExpandPromptButton(this.#services).build();
            const randomizeButton = new RandomizeButton(this.#services).build();

            const secondaryActionRowBuilder = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(expandPromptButton, randomizeButton);

            actionRows.push(secondaryActionRowBuilder);
        }

        return actionRows;
    }
}
