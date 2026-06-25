import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from '../../../../../../IBotServiceContainer.js';
import { SerializableRenderRequest } from '../../../../../media/comfy-ui/models/SerializableRenderRequest.js';
import { DiscordConstants } from '../../../enums/DiscordConstants.js';
import { BaseComponent } from '../../BaseComponent.js';

export class ShowSourceButton extends BaseComponent<ButtonBuilder> {
    override get label(): string {
        return '{\u00A0}';
    }

    override get isSupported(): boolean {
        if (!this.featureService.hasFeature(SupportedFeature.Txt2Img)
            && !this.featureService.hasFeature(SupportedFeature.Txt2Vid)
            && !this.featureService.hasFeature(SupportedFeature.Txt2Music)
            && !this.featureService.hasFeature(SupportedFeature.Txt2Audio)) {
            return false;
        }

        if (this.#renderRequest === null) {
            return false;
        }

        return this.#renderRequest.toString().length <= DiscordConstants.ContentMaxLength;
    }

    override get title(): string {
        return 'Show Source';
    }

    override get helpText(): string {
        return 'Show JSON information used to render the image.'
            + ' This message can be used to fully customize image renders when used as a prompt.'
            + ' _(Hint: use `-1` as the seed to use a random seed.)_'
            + ' Some prompts may be too large to save, so some actions may be hidden when this happens.';
    }

    #renderRequest: SerializableRenderRequest | null;

    constructor(services: IBotServiceContainer, renderRequest: SerializableRenderRequest | null) {
        super(services);
        this.#renderRequest = renderRequest;
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(BotInteraction.ShowSource)
            .setLabel(this.label)
            .setStyle(ButtonStyle.Secondary);
    }

    override buildAsync(): Promise<ButtonBuilder> {
        throw new Error('Method not implemented.');
    }
}
