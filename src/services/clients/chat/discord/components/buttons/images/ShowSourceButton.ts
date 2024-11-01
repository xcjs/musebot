import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class ShowSourceButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '{ }';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.ImageGeneration);
    }

    override get title(): string {
        return 'Show Source';
    }

    override get helpText(): string {
        return 'Show JSON information used to render the image.'
            + ' This message can be used to customize image renders when used as a prompt.'
            + ' Hint - use -1 as the seed to use a random seed.'
            + ' Some images may have large enough prompts that the JSON message cannot be stored alongside the image.'
            + ' In these cases, some actions may be hidden.';
    }

    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.ShowSource)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }
}
