import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';

export class ExpandPromptButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '📃';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.ImagesAndText);
    }

    override get title(): string {
        return 'Expand Prompt';
    }

    override get helpText(): string {
        return 'Your prompt is given to a large language model instructed to improve on or expand the text detail in your prompt.'
            + ' This is then used to render an image with results that may better match your expectations.';
    }

    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.ExpandPrompt)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }
}
