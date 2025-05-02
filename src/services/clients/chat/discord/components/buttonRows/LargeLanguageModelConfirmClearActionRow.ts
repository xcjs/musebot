import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { BaseComponent } from '../BaseComponent.js';
import { ClearContextCancelButton } from '../buttons/text/ClearContextCancelButton.js';
import { ClearContextConfirmButton } from '../buttons/text/ClearContextConfirmButton.js';
import { IActionRowBuilderFactory } from '../IActionRowBuilderFactory.js';

export class LargeLanguageModelConfirmClearActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>[]> {
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

    override build(): Array<ActionRowBuilder<ButtonBuilder>> {
        this.#buttons = [
            new ClearContextCancelButton(this.#services),
            new ClearContextConfirmButton(this.#services)
        ];

        return this.#actionRowBuilderFactory.buildActionRows(this.#buttons);
    }
}
