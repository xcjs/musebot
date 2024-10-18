import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { BaseComponent } from '../BaseComponent.js';
import { ClearContextButton } from '../buttons/ClearContextButton.js';

export class LargeLanguageModelActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>> {
    #services: IServiceContainer;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;
    }

    override build(): ActionRowBuilder<ButtonBuilder> {
        const clearContextButton = new ClearContextButton(this.#services).build();
        const actionRowBuilder = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(clearContextButton);

        return actionRowBuilder;
    }
}
