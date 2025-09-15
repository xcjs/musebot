import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../../IServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class RetryButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '🔄';
    }

    override get isSupported(): boolean {
        return this.featureService.hasFeature(SupportedFeature.Txt2Audio)
            || this.featureService.hasFeature(SupportedFeature.Txt2Img)
            || this.featureService.hasFeature(SupportedFeature.Txt2Music)
            || this.featureService.hasFeature(SupportedFeature.Txt2Vid);
    }

    override get title(): string {
        return 'Retry';
    }

    override get helpText(): string {
        return 'Retries your prompt and responds with a different output.';
    }

    constructor(services: IServiceContainer) {
        super(services);
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.Retry)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }

    override buildAsync(): Promise<ButtonBuilder> {
        throw new Error('Method not implemented.');
    }
}
