import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { BaseComponent } from '../BaseComponent.js';
import { RandomizeButton } from '../buttons/RandomizeButton.js';
import { RetryButton } from '../buttons/RetryButton.js';
import { FeatureService } from '../../../../features/FeatureService.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';

export class StatelessImageGenerationActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>> {
    constructor(featureService: FeatureService) {
        super(featureService);
    }

    override build(): ActionRowBuilder<ButtonBuilder> {
        const retryButton = new RetryButton(this.featureService).build();

        const actionRowBuilder = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(retryButton);

        if(this.featureService.hasFeature(SupportedFeature.RandomImageGeneration)) {
            const randomizeButton = new RandomizeButton(this.featureService).build();
            actionRowBuilder.addComponents(randomizeButton);
        }

        return actionRowBuilder;
    }
}
