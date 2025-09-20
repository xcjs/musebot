import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { BaseComponent } from '../BaseComponent.js';
import { HelpButton } from '../buttons/HelpButton.js';
import { RandomizeButton } from '../buttons/images/RandomizeButton.js';
import { IActionRowBuilderFactory } from '../IActionRowBuilderFactory.js';
import { IActionRows } from './IActionRows.js';

export class StatelessImageGenerationActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>[]> implements IActionRows {
    #buttons: BaseComponent<ButtonBuilder>[] = [];
    get buttons(): BaseComponent<ButtonBuilder>[] {
        return this.#buttons;
    }

    get isAsync(): boolean {
        return false;
    }

    #services: IServiceContainer;

    #actionRowBuilderFactory: IActionRowBuilderFactory;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#actionRowBuilderFactory = services.actionRowBuilderFactory;
    }

    override build(): ActionRowBuilder<ButtonBuilder>[] {
        const buttons: BaseComponent<ButtonBuilder>[] = [
            new RandomizeButton(this.#services),
            new HelpButton(this.#services)
        ];

        this.#buttons = buttons;

        return this.#actionRowBuilderFactory.buildActionRows(buttons);
    }

    override buildAsync(): Promise<ActionRowBuilder<ButtonBuilder>[]> {
        throw new Error('Method not implemented.');
    }
}
