import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { buildActionRows } from '../ActionRowBuilderFactory.js';
import { BaseComponent } from '../BaseComponent.js';
import { HelpButton } from '../buttons/HelpButton.js';
import { RandomizeButton } from '../buttons/images/RandomizeButton.js';
import { UpscaleDesignButton } from '../buttons/images/UpscaleDesignButton.js';
import { UpscaleDetailButton } from '../buttons/images/UpscaleDetailButton.js';

export class StatelessImageGenerationActionRow extends BaseComponent<Array<ActionRowBuilder<ButtonBuilder>>> {
    #services: IServiceContainer;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;
    }

    override build(): Array<ActionRowBuilder<ButtonBuilder>> {
        const buttons: Array<BaseComponent<ButtonBuilder>> = [
            new UpscaleDetailButton(this.#services),
            new UpscaleDesignButton(this.#services),
            new RandomizeButton(this.#services),
            new HelpButton(this.#services)
        ];

        return buildActionRows(buttons);
    }
}
