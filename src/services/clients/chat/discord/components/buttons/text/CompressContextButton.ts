import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from '../../../../../../IBotServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class CompressContextButton extends BaseComponent<ButtonBuilder> {
  override get label(): string {
    return '🗜️';
  }

  override get isSupported(): boolean {
    return this.featureService.hasFeature(SupportedFeature.Txt2Txt);
  }

  override get title(): string {
    return 'Compress Context';
  }

  override get helpText(): string {
    return 'Summarizes the conversational context into a compact summary to free up context window space.';
  }

  constructor(services: IBotServiceContainer) {
    super(services);
  }

  override build(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(BotInteraction.CompressContext)
      .setLabel(this.label)
      .setStyle(ButtonStyle.Secondary);
  }

  override buildAsync(): Promise<ButtonBuilder> {
    throw new Error('Method not implemented.');
  }
}