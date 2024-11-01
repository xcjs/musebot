import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IEnvironmentSettings } from '../../../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { StableDiffusionGuidanceScaleLimit } from '../../../../../images/automatic1111/enums/StableDiffusionGuidanceScaleLimit.js';
import { Txt2ImgOptionsRequest } from '../../../../../images/automatic1111/models/requests/Txt2ImgOptionsRequest.js';
import { EasyDiffusionGuidanceScaleLimit } from '../../../../../images/easy-diffusion/enums/EasyDiffusionGuidanceScaleLimit.js';
import { RenderRequest } from '../../../../../images/easy-diffusion/models/requests/RenderRequest.js';
import { BaseComponent } from '../../BaseComponent.js';

export class GuidanceScaleMinusButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '➖';
    }

    override get isSupported(): boolean {
        let isSupported = true;

        isSupported = this.featureService.hasFeature(SupportedFeature.ImageGeneration);

        if (this.#renderRequest instanceof RenderRequest) {
            isSupported = isSupported
                && this.#renderRequest.guidance_scale - this.#environmentSettings.stableDiffusionGuidanceScaleInterval
                >= EasyDiffusionGuidanceScaleLimit.Min
        } else {
            isSupported = isSupported
                && this.#renderRequest.cfg_scale - this.#environmentSettings.stableDiffusionGuidanceScaleInterval
                >= StableDiffusionGuidanceScaleLimit.Min
        }

        return isSupported;
    }

    override get title(): string {
        return 'Decrease Guidance Scale';
    }

    override get helpText(): string {
        return 'Decreases the guidance scale of your prompt.'
            + ' A lower guidance scale gives the bot more creative freedom with your prompt.';
    }

    #environmentSettings: IEnvironmentSettings;
    #renderRequest: RenderRequest | Txt2ImgOptionsRequest;

    constructor(services: IServiceContainer, renderRequest: RenderRequest | Txt2ImgOptionsRequest) {
        super(services);
        this.#environmentSettings = services.environmentSettings;
        this.#renderRequest = renderRequest;
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.GuidanceScaleMinus)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }
}
