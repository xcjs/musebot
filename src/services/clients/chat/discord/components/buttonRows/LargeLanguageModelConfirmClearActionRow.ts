import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { buildActionRows } from '../ActionRowBuilderFactory.js';
import { BaseComponent } from '../BaseComponent.js';
import { ClearContextCancelButton } from '../buttons/text/ClearContextCancelButton.js';
import { ClearContextConfirmButton } from '../buttons/text/ClearContextConfirmButton.js';

export class LargeLanguageModelConfirmClearActionRow extends BaseComponent<Array<ActionRowBuilder<ButtonBuilder>>> {
    #services: IServiceContainer;

    #buttons: Array<BaseComponent<ButtonBuilder>> = [];
    get buttons(): Array<BaseComponent<ButtonBuilder>> {
        return this.#buttons;
    }

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;
    }

    override build(): Array<ActionRowBuilder<ButtonBuilder>> {
        this.#buttons = [
            new ClearContextCancelButton(this.#services),
            new ClearContextConfirmButton(this.#services)
        ];

        return buildActionRows(this.#buttons);
    }
}
