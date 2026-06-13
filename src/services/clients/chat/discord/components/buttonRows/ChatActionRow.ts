import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IBotServiceContainer } from "../../../../../IBotServiceContainer.js"
import { BaseComponent } from '../BaseComponent.js';
import { HelpButton } from '../buttons/HelpButton.js';
import { ClearContextButton } from '../buttons/text/ClearContextButton.js';
import { IActionRowBuilderFactory } from '../IActionRowBuilderFactory.js';
import { IActionRows } from './IActionRows.js';

export class ChatActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>[]> implements IActionRows {
    #buttons: BaseComponent<ButtonBuilder>[] = [];
    get buttons(): BaseComponent<ButtonBuilder>[] {
        return this.#buttons;
    }

    get isAsync(): boolean {
        return false;
    }

    #services: IBotServiceContainer;

    #actionRowBuilderFactory: IActionRowBuilderFactory;

    constructor(services: IBotServiceContainer) {
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

    override buildAsync(): Promise<ActionRowBuilder<ButtonBuilder>[]> {
        throw new Error('Method not implemented.');
    }
}
