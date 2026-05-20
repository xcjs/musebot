import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from "../../../../../../IServiceContainer.js"
import { BaseComponent } from '../../BaseComponent.js';

export class ClearContextConfirmButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return 'âš ï¸';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.Txt2Txt);
    }

    override get title(): string {
        return 'Confirm Clearing Context';
    }

    override get helpText(): string {
        return 'Clears the conversational context, effectively making the bot forget everything in the discussion so far.'
            + ' Responses may also complete faster afterward as large language model performance can be impacted by large contexts.';
    }

    constructor(services: IBotServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.ClearContextConfirm)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Danger);
    }

    override buildAsync(): Promise<ButtonBuilder> {
        throw new Error('Method not implemented.');
    }
}
