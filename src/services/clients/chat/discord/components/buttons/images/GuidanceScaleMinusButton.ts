import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class GuidanceScaleMinusButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '➖';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.ImageGeneration);
    }

    override get title(): string {
        return 'Decrease Guidance Scale';
    }

    override get helpText(): string {
        return 'Decreases the guidance scale of your prompt.'
            + ' A lower guidance scale gives the bot more creative freedom with your prompt.';
    }

    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.GuidanceScaleMinus)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }
}
