import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from '../../../../../../IBotServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class CompressContextCancelButton extends BaseComponent<ButtonBuilder> {
  override get label(): string {
    return '🔙';
  }

  override get isSupported(): boolean {
    return this.featureService.hasFeature(SupportedFeature.Txt2Txt);
  }

  override get title(): string {
    return 'Cancel Compress Context';
  }

  override get helpText(): string {
    return 'Cancels context compression.';
  }

  constructor(services: IBotServiceContainer) {
    super(services);
  }

  override build(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(BotInteraction.CompressContextCancel)
      .setLabel(this.label)
      .setStyle(ButtonStyle.Secondary);
  }

  override buildAsync(): Promise<ButtonBuilder> {
    throw new Error('Method not implemented.');
  }
}