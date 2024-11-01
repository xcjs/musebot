import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { buildActionRows } from '../ActionRowBuilderFactory.js';
import { BaseComponent } from '../BaseComponent.js';
import { HelpButton } from '../buttons/HelpButton.js';
import { ClearContextButton } from '../buttons/text/ClearContextButton.js';

export class LargeLanguageModelActionRow extends BaseComponent<Array<ActionRowBuilder<ButtonBuilder>>> {
    #services: IServiceContainer;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;
    }

    override build(): Array<ActionRowBuilder<ButtonBuilder>> {
        const buttons: Array<BaseComponent<ButtonBuilder>> = [
            new ClearContextButton(this.#services),
            new HelpButton(this.#services)
        ];

        return buildActionRows(buttons);
    }
}
