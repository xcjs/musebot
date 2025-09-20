import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../../features/IFeatureService.js';
import { ILogger } from '../../../../../ILogger.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { IWorkflowService } from '../../../../media/comfy-ui/services/IWorkflowService.js';
import { BaseComponent } from '../BaseComponent.js';
import { DynamicButton } from '../buttons/DynamicButton.js';
import { IActionRowBuilderFactory } from '../IActionRowBuilderFactory.js';
import { IActionRows } from './IActionRows.js';

export class Img2ImgActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>[]> implements IActionRows {
    #buttons: BaseComponent<ButtonBuilder>[] = [];
    get buttons(): BaseComponent<ButtonBuilder>[] {
        return this.#buttons;
    }

    get isAsync(): boolean {
        return true;
    }

    #services: IServiceContainer;

    #featureService: IFeatureService;
    #workflowService: IWorkflowService;
    #actionRowBuilderFactory: IActionRowBuilderFactory;

    #logger: ILogger;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#featureService = services.featureService;
        this.#workflowService = services.workflowService;
        this.#actionRowBuilderFactory = services.actionRowBuilderFactory;

        this.#logger = services.getLogger('Img2ImgActionRow');
    }

    override build(): ActionRowBuilder<ButtonBuilder>[] {
        throw new Error('The Img2ImgActionRow must be built using buildAsync().');
    }

    override async buildAsync(): Promise<ActionRowBuilder<ButtonBuilder>[]> {
        if(!this.#featureService.hasFeature(SupportedFeature.Img2Img)) {
            return [];
        }

        await this.#workflowService.loadWorkflows();
        const img2ImgWorkflows = this.#workflowService.workflows.filter(x =>
            x.type === SupportedFeature.Img2Img
            || x.type === SupportedFeature.Img2Vid);

        const buttons = img2ImgWorkflows.map((workflow) => {
            const renderRequest = this.#workflowService.getWorkflowDefaults(workflow);

            if(renderRequest.label === ''
                || renderRequest.label === null
                || renderRequest.label === undefined
            ) {
                const error = `The workflow "${workflow.name}" does not contain a usable label. `
                    + `Add a label, save your workflow, and try again.`;

                this.#logger.error(error);
                throw new Error(error);
            }

            return new DynamicButton(this.#services,
                renderRequest.label,
                renderRequest.title,
                renderRequest.helpText);
        });

        this.#buttons = buttons;

        return this.#actionRowBuilderFactory.buildActionRows(buttons);
    }
}
