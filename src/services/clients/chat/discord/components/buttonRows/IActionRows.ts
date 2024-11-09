import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { BaseComponent } from '../BaseComponent.js';

export interface IActionRows {
    get buttons(): Array<BaseComponent<ButtonBuilder>>;

    build(): Array<ActionRowBuilder<ButtonBuilder>>
}
