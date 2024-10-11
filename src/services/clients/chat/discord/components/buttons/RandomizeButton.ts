import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from 'enums/BotInteraction.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { BaseComponent } from 'services/clients/chat/discord/components/BaseComponent.js';

export class RandomizeButton extends BaseComponent<ButtonBuilder> {
    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.Randomize)
            .setLabel('🎲')
            .setStyle(ButtonStyle.Danger);
    }
}
