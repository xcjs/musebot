import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { IEnvironmentSettings } from '../../../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from "../../../../../../IServiceContainer.js"
import { SerializableRenderRequest } from '../../../../../media/comfy-ui/models/SerializableRenderRequest.js';
import { guidanceScaleMax } from '../../../../../media/stable-diffusion/constants/constants.js';
import { BaseComponent } from '../../BaseComponent.js';

export class GuidanceScalePlusButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return 'âž•';
    }

    override get isSupported(): boolean {
        let isSupported = true;

        isSupported = this.featureService.hasFeature(SupportedFeature.Txt2Audio)
            || this.featureService.hasFeature(SupportedFeature.Txt2Img)
            || this.featureService.hasFeature(SupportedFeature.Txt2Music)
            || this.featureService.hasFeature(SupportedFeature.Txt2Vid);

        if (this.#renderRequest === null) {
            return false;
        }

        isSupported = isSupported
            && this.#renderRequest.cfgScale - this.#environmentSettings.stableDiffusionGuidanceScaleInterval
                <= guidanceScaleMax;

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
    #renderRequest: SerializableRenderRequest | null;

    constructor(services: IBotServiceContainer, renderRequest: SerializableRenderRequest | null) {
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

    override buildAsync(): Promise<ButtonBuilder> {
        throw new Error('Method not implemented.');
    }
}
