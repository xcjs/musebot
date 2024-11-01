import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class UpscaleButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '🔍';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.ImageGeneration);
    }

    override get title(): string {
        return 'Upscale';
    }

    override get helpText(): string {
        return 'Use machine learning to enlarge your image.';
    }

    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.Upscale)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }
}
