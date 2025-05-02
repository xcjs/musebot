import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { BaseComponent } from '../BaseComponent.js';
import { HelpButton } from '../buttons/HelpButton.js';
import { RandomizeButton } from '../buttons/images/RandomizeButton.js';
import { UpscaleDesignButton } from '../buttons/images/UpscaleDesignButton.js';
import { UpscaleDetailButton } from '../buttons/images/UpscaleDetailButton.js';
import { IActionRowBuilderFactory } from '../IActionRowBuilderFactory.js';

export class StatelessImageGenerationActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>[]> {
    #services: IServiceContainer;
    #actionRowBuilderFactory: IActionRowBuilderFactory;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#actionRowBuilderFactory = services.actionRowBuilderFactory;
    }

    override build(): Array<ActionRowBuilder<ButtonBuilder>> {
        const buttons: Array<BaseComponent<ButtonBuilder>> = [
            new UpscaleDetailButton(this.#services),
            new UpscaleDesignButton(this.#services),
            new RandomizeButton(this.#services),
            new HelpButton(this.#services)
        ];

        return this.#actionRowBuilderFactory.buildActionRows(buttons);
    }
}
