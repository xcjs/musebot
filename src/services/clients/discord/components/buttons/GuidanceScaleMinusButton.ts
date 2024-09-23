import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BaseComponent } from '../BaseComponent.js';
import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';

export class GuidanceScaleMinusButton extends BaseComponent<ButtonBuilder> {
    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.GuidanceScaleMinus)
            .setLabel('➖')
            .setStyle(ButtonStyle.Secondary);
    }
}
