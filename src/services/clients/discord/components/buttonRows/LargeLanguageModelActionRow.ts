import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { BaseComponent } from '../BaseComponent.js';
import { ClearContextButton } from '../buttons/ClearContextButton.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';

export class LargeLanguageModelActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>> {


    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ActionRowBuilder<ButtonBuilder> {
        const clearContextButton = new ClearContextButton(this.featureService).build();
        const actionRowBuilder = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(clearContextButton);

        return actionRowBuilder;
    }
}
