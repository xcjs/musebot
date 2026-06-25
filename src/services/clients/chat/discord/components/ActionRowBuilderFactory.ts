import { ActionRowBuilder, ButtonBuilder } from 'discord.js'

import { DiscordConstants } from '../enums/DiscordConstants.js';
import { BaseComponent } from './BaseComponent.js'
import { IActionRowBuilderFactory } from './IActionRowBuilderFactory.js';

export class ActionRowBuilderFactory implements IActionRowBuilderFactory {
    buildActionRows(buttons: BaseComponent<ButtonBuilder>[]): ActionRowBuilder<ButtonBuilder>[] {
        const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
        let actionRow: ActionRowBuilder<ButtonBuilder> | null = null;

        const addedButtons: BaseComponent<ButtonBuilder>[] = [];

        buttons.forEach((button, i) => {
            actionRow ??= new ActionRowBuilder<ButtonBuilder>();

            if (button.isSupported
                && !addedButtons.includes(button)
            ) {
                actionRow.addComponents(button.build());
                addedButtons.push(button);
            }

            if (actionRow.components.length > 0
                && actionRow.components.length % DiscordConstants.MaxButtonsPerActionRow === 0
                || i === buttons.length - 1
            ) {
                actionRows.push(actionRow);
                actionRow = null;
            }
        });

        return actionRows;
    }
}
