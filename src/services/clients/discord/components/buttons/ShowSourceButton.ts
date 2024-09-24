import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BaseComponent } from '../BaseComponent.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { BotInteraction } from '../../../../../enums/BotInteraction.js';

export class ShowSourceButton extends BaseComponent<ButtonBuilder> {
    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.ShowSource)
            .setLabel('{ }')
            .setStyle(ButtonStyle.Secondary);
    }
}
