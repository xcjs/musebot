import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { BaseComponent } from '../BaseComponent.js';
import { HelpButton } from '../buttons/HelpButton.js';
import { ClearContextButton } from '../buttons/text/ClearContextButton.js';
import { IActionRowBuilderFactory } from '../IActionRowBuilderFactory.js';

export class LargeLanguageModelActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>[]> {
    #buttons: BaseComponent<ButtonBuilder>[] = [];
    get buttons(): BaseComponent<ButtonBuilder>[] {
        return this.#buttons;
    }

    #services: IServiceContainer;

    #actionRowBuilderFactory: IActionRowBuilderFactory;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;
        this.#actionRowBuilderFactory = services.actionRowBuilderFactory;
    }

    override build(): ActionRowBuilder<ButtonBuilder>[] {
        this.#buttons = [
            new ClearContextButton(this.#services),
            new HelpButton(this.#services)
        ];

        return this.#actionRowBuilderFactory.buildActionRows(this.#buttons);
    }
}
