import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { BaseComponent } from 'services/clients/chat/discord/components/BaseComponent.js';
import { ClearContextButton } from 'services/clients/chat/discord/components/buttons/ClearContextButton.js';
import { IServiceContainer } from 'services/IServiceContainer.js';

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
