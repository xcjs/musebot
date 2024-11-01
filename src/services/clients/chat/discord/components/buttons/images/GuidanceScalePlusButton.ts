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

export class GuidanceScalePlusButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '➕';
    }

    override get isSupported(): boolean {
        let isSupported = true;

        isSupported = this.featureService.hasFeature(SupportedFeature.ImageGeneration);

        if (this.#renderRequest instanceof RenderRequest) {
            isSupported = isSupported
                && this.#renderRequest.guidance_scale - this.#environmentSettings.stableDiffusionGuidanceScaleInterval
                    <= EasyDiffusionGuidanceScaleLimit.Max
        } else {
            isSupported = isSupported
                && this.#renderRequest.cfg_scale - this.#environmentSettings.stableDiffusionGuidanceScaleInterval
                    <= StableDiffusionGuidanceScaleLimit.Max
        }

        return isSupported;
    }

    override get title(): string {
        return 'Increase Guidance Scale';
    }

    override get helpText(): string {
        return 'Increases the guidance scale of your prompt.'
            + ' A higher guidance scale forces the bot to more strictly follow your prompt.';
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
            .setCustomId(BotInteraction.GuidanceScalePlus)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }
}
