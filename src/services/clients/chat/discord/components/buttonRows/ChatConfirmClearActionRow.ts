import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IBotServiceContainer } from "../../../../../IBotServiceContainer.js"
import { BaseComponent } from '../BaseComponent.js';
import { ClearContextCancelButton } from '../buttons/text/ClearContextCancelButton.js';
import { ClearContextConfirmButton } from '../buttons/text/ClearContextConfirmButton.js';
import { IActionRowBuilderFactory } from '../IActionRowBuilderFactory.js';
import { IActionRows } from './IActionRows.js';

export class ChatConfirmClearActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>[]> implements IActionRows {
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
            new ClearContextCancelButton(this.#services),
            new ClearContextConfirmButton(this.#services)
        ];

        return this.#actionRowBuilderFactory.buildActionRows(this.#buttons);
    }

    override buildAsync(): Promise<ActionRowBuilder<ButtonBuilder>[]> {
        throw new Error('Method not implemented.');
    }
}
