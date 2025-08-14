import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { APPLICATION_NAME } from '../../../../../../constants/Globals.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { BaseComponent } from '../BaseComponent.js';

export class DynamicButton extends BaseComponent<ButtonBuilder> {
    #label: string = '';
    override get label(): string {
        return this.#label;
    }

    override get isSupported(): boolean {
        // If a DynamicButton gets instantiated, it has already passed a feature detection check.
        return true;
    }

    #title: string = '';
    override get title(): string {
        return this.#title;
    }

    #helpText: string;
    override get helpText(): string {
        return this.#helpText;
    }

    constructor(services: IServiceContainer,
        label: string,
        title: string | undefined,
        helpText: string | undefined) {
        super(services);

        this.#label = label;

        this.#title = title
            || `Your ${APPLICATION_NAME} administrator has not provided a title for this workflow. Ask them to add one!`;

        this.#helpText = helpText
            || `Your ${APPLICATION_NAME} administrator has not provided help text explaining this workflow. Ask them to add some!`;
    }

    override build(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(this.#label)
            .setLabel(this.#label)
            .setStyle(ButtonStyle.Secondary);
    }

    override buildAsync(): Promise<ButtonBuilder> {
        throw new Error('Method not implemented.');
    }
}
