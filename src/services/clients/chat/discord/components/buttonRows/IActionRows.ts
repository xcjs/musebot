import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { BaseComponent } from '../BaseComponent.js';

export interface IActionRows {
    get buttons(): BaseComponent<ButtonBuilder>[];

    build(): ActionRowBuilder<ButtonBuilder>[];
}
