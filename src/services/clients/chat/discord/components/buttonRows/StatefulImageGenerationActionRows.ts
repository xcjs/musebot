import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { SerializableRenderRequest } from '../../../../images/stable-diffusion/models/SerializableRenderRequest.js';
import { buildActionRows } from '../ActionRowBuilderFactory.js';
import { BaseComponent } from '../BaseComponent.js';
import { HelpButton } from '../buttons/HelpButton.js';
import { ExpandPromptButton } from '../buttons/images/ExpandPromptButton.js';
import { GuidanceScaleMinusButton } from '../buttons/images/GuidanceScaleMinusButton.js';
import { GuidanceScalePlusButton } from '../buttons/images/GuidanceScalePlusButton.js';
import { RandomizeButton } from '../buttons/images/RandomizeButton.js';
import { RetryButton } from '../buttons/images/RetryButton.js';
import { ShowSourceButton } from '../buttons/images/ShowSourceButton.js';
import { UpscaleDesignButton } from '../buttons/images/UpscaleDesignButton.js';
import { UpscaleDetailButton } from '../buttons/images/UpscaleDetailButton.js';

export class StatefulImageGenerationActionRows extends BaseComponent<Array<ActionRowBuilder<ButtonBuilder>>> {
    get buttons(): Array<BaseComponent<ButtonBuilder>> {
        return this.#buttons;
    }

    #services: IServiceContainer;

    #renderRequest: SerializableRenderRequest | null;

    #buttons: Array<BaseComponent<ButtonBuilder>> = [];

    constructor(services: IServiceContainer,
        renderRequest: SerializableRenderRequest | null) {
        super(services);
        this.#services = services;
        this.#renderRequest = renderRequest;
    }

    override build(): Array<ActionRowBuilder<ButtonBuilder>> {
        this.#buttons = [
            new RetryButton(this.#services),
            new UpscaleDetailButton(this.#services),
            new UpscaleDesignButton(this.#services),
            new GuidanceScaleMinusButton(this.#services, this.#renderRequest),
            new GuidanceScalePlusButton(this.#services, this.#renderRequest),
            new ExpandPromptButton(this.#services),
            new RandomizeButton(this.#services),
            new ShowSourceButton(this.#services),
            new HelpButton(this.#services)
        ];

        return buildActionRows(this.#buttons);
    }
}
