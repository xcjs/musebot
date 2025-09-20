import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class ClearContextCancelButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '↩️';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.Txt2Txt);
    }

    override get title(): string {
        return 'Cancel Clearing Context';
    }

    override get helpText(): string {
        return 'Cancels clearing the conversational context, allowing the bot to continue the conversation where it left off.';
    }

    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.ClearContextCancel)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }

    override buildAsync(): Promise<ButtonBuilder> {
        throw new Error('Method not implemented.');
    }
}
