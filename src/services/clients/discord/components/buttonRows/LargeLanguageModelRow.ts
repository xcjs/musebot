import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { BaseComponent } from '../BaseComponent.js';
import { FeatureService } from '../../../../features/FeatureService.js';
import { ClearContextButton } from '../buttons/ClearContextButton.js';

export class LargeLanguageModelRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>> {
    constructor(featureService: FeatureService) {
        super(featureService);
    }

    override build(): ActionRowBuilder<ButtonBuilder> {
        const clearContextButton = new ClearContextButton(this.featureService).build();
        const actionRowBuilder = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(clearContextButton);

        return actionRowBuilder;
    }
}
