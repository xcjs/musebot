import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class RandomizeButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '⠀🎲⠀';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.ImageGeneration)
            && this.featureService.hasFeature(SupportedFeature.TextGeneration);
    }

    override get title(): string {
        return 'Randomize';
    }

    override get helpText(): string {
        return 'Generate a random story or description with a large language model and render the result as an image.'
            + ' The result will not be related to the context of the previous image.';
    }

    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.Randomize)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Danger);
    }
}
