import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { Txt2ImgOptionsRequest } from '../../../../images/automatic1111/models/requests/Txt2ImgOptionsRequest.js';
import { RenderRequest } from '../../../../images/easy-diffusion/models/requests/RenderRequest.js';
import { buildActionRows } from '../ActionRowBuilderFactory.js';
import { BaseComponent } from '../BaseComponent.js';
import { ExpandPromptButton } from '../buttons/images/ExpandPromptButton.js';
import { GuidanceScaleMinusButton } from '../buttons/images/GuidanceScaleMinusButton.js';
import { GuidanceScalePlusButton } from '../buttons/images/GuidanceScalePlusButton.js';
import { RandomizeButton } from '../buttons/images/RandomizeButton.js';
import { RetryButton } from '../buttons/images/RetryButton.js';
import { ShowSourceButton } from '../buttons/images/ShowSourceButton.js';
import { UpscaleButton } from '../buttons/images/UpscaleButton.js';
import { HelpButton } from '../buttons/HelpButton.js';

export class StatefulImageGenerationActionRows extends BaseComponent<Array<ActionRowBuilder<ButtonBuilder>>> {
    #services: IServiceContainer;

    #renderRequest: RenderRequest | Txt2ImgOptionsRequest;

    constructor(services: IServiceContainer, renderRequest: RenderRequest | Txt2ImgOptionsRequest) {
        super(services);
        this.#services = services;
        this.#renderRequest = renderRequest;
    }

    override build(): Array<ActionRowBuilder<ButtonBuilder>> {
        const buttons: Array<BaseComponent<ButtonBuilder>> = [
            new RetryButton(this.#services),
            new ShowSourceButton(this.#services),
            new UpscaleButton(this.#services),
            new GuidanceScaleMinusButton(this.#services, this.#renderRequest),
            new GuidanceScalePlusButton(this.#services, this.#renderRequest),
            new ExpandPromptButton(this.#services),
            new RandomizeButton(this.#services),
            new HelpButton(this.#services)
        ];

        return buildActionRows(buttons);
    }
}
