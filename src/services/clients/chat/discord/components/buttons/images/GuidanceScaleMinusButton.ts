import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { IConfigurationService } from '../../../../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from "../../../../../../IBotServiceContainer.js"
import { SerializableRenderRequest } from '../../../../../media/comfy-ui/models/SerializableRenderRequest.js';
import { guidanceScaleMin } from '../../../../../media/stable-diffusion/constants/constants.js';
import { BaseComponent } from '../../BaseComponent.js';

export class GuidanceScaleMinusButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '➖';
    }

    override get isSupported(): boolean {
        let isSupported = true;

        isSupported = this.featureService.hasFeature(SupportedFeature.Txt2Audio)
            || this.featureService.hasFeature(SupportedFeature.Txt2Img)
            || this.featureService.hasFeature(SupportedFeature.Txt2Music)
            || this.featureService.hasFeature(SupportedFeature.Txt2Vid);

        if(this.#renderRequest === null) {
            return false;
        }

        isSupported = isSupported
            && this.#renderRequest.cfgScale - this.#configurationService.comfyUiGuidanceScaleInterval
            >= guidanceScaleMin;

        return isSupported;
    }

    override get title(): string {
        return 'Decrease Guidance Scale';
    }

    override get helpText(): string {
        return 'Decreases the guidance scale of your prompt.'
            + ' A lower guidance scale gives the bot more creative freedom with your prompt.';
    }

    #configurationService: IConfigurationService;
    #renderRequest: SerializableRenderRequest | null;

    constructor(services: IBotServiceContainer, renderRequest: SerializableRenderRequest | null) {
        super(services);
        this.#configurationService = services.configurationService;
        this.#renderRequest = renderRequest;
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.GuidanceScaleMinus)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }

    override buildAsync(): Promise<ButtonBuilder> {
        throw new Error('Method not implemented.');
    }
}
