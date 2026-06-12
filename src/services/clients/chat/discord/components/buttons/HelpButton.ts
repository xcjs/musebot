import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { IBotServiceContainer } from "../../../../../IBotServiceContainer.js"
import { BaseComponent } from '../BaseComponent.js';

export class HelpButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return 'â”';
    }

    override get isSupported(): boolean {
        return true;
    }

    override get title(): string {
        return 'Help';
    }

    override get helpText(): string {
        return 'Show this help information.';
    }

    constructor(services: IBotServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.Help)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }

    override buildAsync(): Promise<ButtonBuilder> {
        throw new Error('Method not implemented.');
    }
}
