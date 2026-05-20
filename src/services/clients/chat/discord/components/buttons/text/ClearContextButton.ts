import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from "../../../../../../IServiceContainer.js"
import { BaseComponent } from '../../BaseComponent.js';

export class ClearContextButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return 'ðŸ†‘';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.Txt2Txt);
    }

    override get title(): string {
        return 'Clear Context';
    }

    override get helpText(): string {
        return 'Asks for confirmation to clear the conversational context.';
    }

    constructor(services: IBotServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.ClearContext)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }

    override buildAsync(): Promise<ButtonBuilder> {
        throw new Error('Method not implemented.');
    }
}
