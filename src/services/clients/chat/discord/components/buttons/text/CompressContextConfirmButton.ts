import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from '../../../../../../IBotServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class CompressContextConfirmButton extends BaseComponent<ButtonBuilder> {
  override get label(): string {
    return '✅';
  }

  override get isSupported(): boolean {
    return this.featureService.hasFeature(SupportedFeature.Txt2Txt);
  }

  override get title(): string {
    return 'Confirm Compress Context';
  }

  override get helpText(): string {
    return 'Confirms context compression.';
  }

  constructor(services: IBotServiceContainer) {
    super(services);
  }

  override build(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(BotInteraction.CompressContextConfirm)
      .setLabel(this.label)
      .setStyle(ButtonStyle.Danger);
  }

  override buildAsync(): Promise<ButtonBuilder> {
    throw new Error('Method not implemented.');
  }
}