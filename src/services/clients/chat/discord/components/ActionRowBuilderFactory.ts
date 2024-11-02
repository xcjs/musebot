import { ActionRowBuilder, ButtonBuilder } from 'discord.js'

import { DiscordConstants } from '../enums/DiscordConstants.js';
import { BaseComponent } from './BaseComponent.js'

export function buildActionRows(buttons: Array<BaseComponent<ButtonBuilder>>): Array<ActionRowBuilder<ButtonBuilder>> {
    const actionRows: Array<ActionRowBuilder<ButtonBuilder>> = [];
    let actionRow: ActionRowBuilder<ButtonBuilder> | null = null;

    buttons.forEach((button, i) => {
        if (actionRow === null) {
            actionRow = new ActionRowBuilder<ButtonBuilder>();
        }

        if(button.isSupported) {
            actionRow.addComponents(button.build());
        }

        if(actionRow.components.length % DiscordConstants.MaxButtonsPerActionRow === 0
            || buttons.length - 1 === i
        ) {
            actionRows.push(actionRow);
            actionRow = null;
        }
    });

    return actionRows;
}
