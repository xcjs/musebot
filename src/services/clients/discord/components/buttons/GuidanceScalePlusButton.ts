import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BaseComponent } from '../BaseComponent.js';
import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { FeatureService } from '../../../../features/FeatureService.js';

export class GuidanceScalePlusButton extends BaseComponent<ButtonBuilder> {
    constructor(featureService: FeatureService) {
        super(featureService);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.GuidanceScalePlus)
            .setLabel('➕')
            .setStyle(ButtonStyle.Secondary);
    }
}
