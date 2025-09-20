import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { BaseComponent } from '../BaseComponent.js';
import { HelpButton } from '../buttons/HelpButton.js';
import { IActionRowBuilderFactory } from '../IActionRowBuilderFactory.js';
import { IActionRows } from './IActionRows.js';

export class StatelessAudioGenerationActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>[]> implements IActionRows {
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
        this.#buttons = [
            new HelpButton(this.#services)
        ];

        return this.#actionRowBuilderFactory.buildActionRows(this.#buttons);
    }

    override buildAsync(): Promise<ActionRowBuilder<ButtonBuilder>[]> {
        throw new Error('Method not implemented.');
    }
}
