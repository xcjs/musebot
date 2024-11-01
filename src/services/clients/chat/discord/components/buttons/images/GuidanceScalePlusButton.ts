import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';

export class GuidanceScalePlusButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '➕';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.ImageGeneration);
    }

    override get title(): string {
        return 'Increase Guidance Scale';
    }

    override get helpText(): string {
        return 'Increases the guidance scale of your prompt.'
            + ' A higher guidance scale forces the bot to more strictly follow your prompt.';
    }

    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.GuidanceScalePlus)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }
}
