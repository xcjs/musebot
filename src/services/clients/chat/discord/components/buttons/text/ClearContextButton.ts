import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class ClearContextButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '🆑';
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
