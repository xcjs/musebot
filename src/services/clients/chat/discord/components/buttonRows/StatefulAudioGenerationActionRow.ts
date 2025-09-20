import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { SerializableRenderRequest } from '../../../../media/comfy-ui/models/SerializableRenderRequest.js';
import { BaseComponent } from '../BaseComponent.js';
import { HelpButton } from '../buttons/HelpButton.js';
import { GuidanceScaleMinusButton } from '../buttons/images/GuidanceScaleMinusButton.js';
import { GuidanceScalePlusButton } from '../buttons/images/GuidanceScalePlusButton.js';
import { RetryButton } from '../buttons/images/RetryButton.js';
import { IActionRowBuilderFactory } from '../IActionRowBuilderFactory.js';
import { IActionRows } from './IActionRows.js';

export class StatefulAudioGenerationActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>[]> implements IActionRows {
    #buttons: BaseComponent<ButtonBuilder>[] = [];
    get buttons(): BaseComponent<ButtonBuilder>[] {
        return this.#buttons;
    }

    get isAsync(): boolean {
        return false;
    }

    #services: IServiceContainer;

    #actionRowBuilderFactory: IActionRowBuilderFactory;

    #renderRequest: SerializableRenderRequest | null;

    constructor(services: IServiceContainer,
        renderRequest: SerializableRenderRequest | null) {
        super(services);
        this.#services = services;

        this.#actionRowBuilderFactory = services.actionRowBuilderFactory;

        this.#renderRequest = renderRequest;
    }

    override build(): ActionRowBuilder<ButtonBuilder>[] {
        this.#buttons = [
            new RetryButton(this.#services),
            new GuidanceScaleMinusButton(this.#services, this.#renderRequest),
            new GuidanceScalePlusButton(this.#services, this.#renderRequest),
            new HelpButton(this.#services)
        ];

        return this.#actionRowBuilderFactory.buildActionRows(this.#buttons);
    }

    override buildAsync(): Promise<ActionRowBuilder<ButtonBuilder>[]> {
        throw new Error('Method not implemented.');
    }
}
