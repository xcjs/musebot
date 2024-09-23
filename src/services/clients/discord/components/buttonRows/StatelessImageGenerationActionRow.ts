import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { BaseComponent } from '../BaseComponent.js';
import { RandomizeButton } from '../buttons/RandomizeButton.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';

export class StatelessImageGenerationActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>> {
    #services: IServiceContainer;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;
    }

    override build(): ActionRowBuilder<ButtonBuilder> {
        const actionRowBuilder = new ActionRowBuilder<ButtonBuilder>();

        if(this.featureService.hasFeature(SupportedFeature.ImagesAndText)) {
            const randomizeButton = new RandomizeButton(this.#services).build();
            actionRowBuilder.addComponents(randomizeButton);
        }

        return actionRowBuilder;
    }
}
