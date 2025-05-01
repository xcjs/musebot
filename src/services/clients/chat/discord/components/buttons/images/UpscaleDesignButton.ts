import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class UpscaleDesignButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '🔍🎨';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.Img2ImgUpscaling);
    }

    override get title(): string {
        return 'Design Upscale';
    }

    override get helpText(): string {
        return 'Use machine learning to enlarge a design or graphic based image.'
            + ' This works best with images that use a limited color palette or have simple contours.';
    }

    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.UpscaleDesign)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }
}
