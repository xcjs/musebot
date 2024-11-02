import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { buildActionRows } from '../ActionRowBuilderFactory.js';
import { BaseComponent } from '../BaseComponent.js';
import { HelpButton } from '../buttons/HelpButton.js';
import { RandomizeButton } from '../buttons/images/RandomizeButton.js';

export class StatelessImageGenerationActionRow extends BaseComponent<Array<ActionRowBuilder<ButtonBuilder>>> {
    #services: IServiceContainer;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;
    }

    override build(): Array<ActionRowBuilder<ButtonBuilder>> {
        const buttons: Array<BaseComponent<ButtonBuilder>> = [
            new RandomizeButton(this.#services),
            new HelpButton(this.#services)
        ];

        return buildActionRows(buttons);
    }
}
