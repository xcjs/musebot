import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class UpscaleDetailButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '🔍📷';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.ImageGeneration);
    }

    override get title(): string {
        return 'Detail Upscale';
    }

    override get helpText(): string {
        return 'Use machine learning to enlarge a detailed or realistic image.';
    }

    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.UpscaleDetail)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }
}
