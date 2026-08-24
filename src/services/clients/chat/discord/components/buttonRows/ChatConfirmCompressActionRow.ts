import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IBotServiceContainer } from '../../../../../IBotServiceContainer.js';
import { BaseComponent } from '../BaseComponent.js';
import { CompressContextCancelButton } from '../buttons/text/CompressContextCancelButton.js';
import { CompressContextConfirmButton } from '../buttons/text/CompressContextConfirmButton.js';
import { IActionRowBuilderFactory } from '../IActionRowBuilderFactory.js';
import { IActionRows } from './IActionRows.js';

export class ChatConfirmCompressActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>[]> implements IActionRows {
  #buttons: BaseComponent<ButtonBuilder>[] = [];
  get buttons(): BaseComponent<ButtonBuilder>[] {
    return this.#buttons;
  }

  get isAsync(): boolean {
    return false;
  }

  #services: IBotServiceContainer;

  #actionRowBuilderFactory: IActionRowBuilderFactory;

  constructor(services: IBotServiceContainer) {
    super(services);

    this.#services = services;
    this.#actionRowBuilderFactory = services.actionRowBuilderFactory;
  }

  override build(): ActionRowBuilder<ButtonBuilder>[] {
    this.#buttons = [
      new CompressContextCancelButton(this.#services),
      new CompressContextConfirmButton(this.#services)
    ];

    return this.#actionRowBuilderFactory.buildActionRows(this.#buttons);
  }

  override buildAsync(): Promise<ActionRowBuilder<ButtonBuilder>[]> {
    throw new Error('Method not implemented.');
  }
}