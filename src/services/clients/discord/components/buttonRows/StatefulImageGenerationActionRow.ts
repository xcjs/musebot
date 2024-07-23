import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { BaseComponent } from '../BaseComponent';
import { RandomizeButton } from '../buttons/RandomizeButton';
import { RetryButton } from '../buttons/RetryButton';
import { GuidanceScaleMinusButton } from '../buttons/GuidanceScaleMinusButton';
import { GuidanceScalePlusButton } from '../buttons/GuidanceScalePlusButton';
import { ShowSourceButton } from '../buttons/ShowSourceButton';
import { FeatureService } from '../../../../features/FeatureService.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature';

export class StatefulImageGenerationActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>> {
    constructor(featureService: FeatureService) {
        super(featureService);
    }

    override build(): ActionRowBuilder<ButtonBuilder> {
        const retryButton = new RetryButton(this.featureService).build();
        const showSourceButton = new ShowSourceButton(this.featureService).build();
        const guidanceScaleMinusButton = new GuidanceScaleMinusButton(this.featureService).build();
        const guidanceScalePlusButton = new GuidanceScalePlusButton(this.featureService).build();

        const actionRowBuilder = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(retryButton, showSourceButton, guidanceScaleMinusButton, guidanceScalePlusButton);

        if(this.featureService.hasFeature(SupportedFeature.RandomImageGeneration)) {
            const randomizeButton = new RandomizeButton(this.featureService).build();
            actionRowBuilder.addComponents(randomizeButton);
        }

        return actionRowBuilder;
    }
}
