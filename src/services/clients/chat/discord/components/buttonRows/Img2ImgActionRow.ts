import { ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../../features/IFeatureService.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { IWorkflowService } from '../../../../images/comfy-ui/services/IWorkflowService.js';
import { BaseComponent } from '../BaseComponent.js';
import { DynamicButton } from '../buttons/DynamicButton.js';
import { IActionRowBuilderFactory } from '../IActionRowBuilderFactory.js';

export class Img2ImgActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>[]> {
    #services: IServiceContainer;

    #featureService: IFeatureService;
    #workflowService: IWorkflowService;
    #actionRowBuilderFactory: IActionRowBuilderFactory;

    #logger;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#featureService = services.featureService;
        this.#workflowService = services.workflowService;
        this.#actionRowBuilderFactory = services.actionRowBuilderFactory;

        this.#logger = new Logger(services.environmentSettings.isProduction, 'Img2ImgActionRow');
    }

    override build(): ActionRowBuilder<ButtonBuilder>[] {
        throw 'The Img2ImgActionRow must be built using buildAsync().';
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

                this.#logger(LogLevel.Error, error);
                throw new Error(error);
            }

            return new DynamicButton(this.#services,
                renderRequest.label,
                renderRequest.title,
                renderRequest.helpText);
        });

        return this.#actionRowBuilderFactory.buildActionRows(buttons);
    }
}
