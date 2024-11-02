import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class ClearContextButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '🆑';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.TextGeneration);
    }

    override get title(): string {
        return 'Clear Context';
    }

    override get helpText(): string {
        return 'Clears the conversational context, effectively making the bot forget everything in the discussion so far.'
            + ' Responses may also complete faster afterward as large language model performance can be impacted by large contexts.';
    }

    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.ClearContext)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }
}
