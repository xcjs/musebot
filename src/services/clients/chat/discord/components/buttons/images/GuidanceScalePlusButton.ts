import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { IEnvironmentSettings } from '../../../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { GuidanceScaleLimit } from '../../../../../media/stable-diffusion/enums/GuidanceScaleLimit.js';
import { SerializableRenderRequest } from '../../../../../media/stable-diffusion/models/SerializableRenderRequest.js';
import { BaseComponent } from '../../BaseComponent.js';

export class GuidanceScalePlusButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '➕';
    }

    override get isSupported(): boolean {
        let isSupported = true;

        isSupported = this.featureService.hasFeature(SupportedFeature.Txt2Img)
            || this.featureService.hasFeature(SupportedFeature.Txt2Vid);

        if (this.#renderRequest === null) {
            return false;
        }

        isSupported = isSupported
            && this.#renderRequest.cfgScale - this.#environmentSettings.stableDiffusionGuidanceScaleInterval
                <= GuidanceScaleLimit.Max;

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

    constructor(services: IServiceContainer, renderRequest: SerializableRenderRequest | null) {
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
