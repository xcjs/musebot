import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { BaseComponent } from './BaseComponent.js';

export interface IActionRowBuilderFactory {
    buildActionRows(buttons: BaseComponent<ButtonBuilder>[]): ActionRowBuilder<ButtonBuilder>[];
    buildDynamiceActionRows(): Promise<ActionRowBuilder<ButtonBuilder>[]>;
}
