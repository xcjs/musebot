import { ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';

export abstract class ComfyUiBaseTask extends BaseTask {
    comfyUiClient: ComfyUiClient;

    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #taskQueue: ITaskQueue;

    #interaction: Message | ButtonInteraction;

    #logger;

    constructor(services: IServiceContainer, interaction: Message | ButtonInteraction) {
        super(services);

        this.comfyUiClient = services.comfyUiClient;

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#taskQueue = services.taskQueue;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiBaseTask');
    }

    override async process(): Promise<void> {
        await super.process();

        if(this.#interaction instanceof ButtonInteraction) {
            this.#logger(LogLevel.Info, 'The interaction is a button interaction - sending acknowledgement of task receipt.');
            await this.#interaction.editReply('Got it! I\'ll get started soon!');
        }

        this.#logger(LogLevel.Info, 'Loading workflows...');
        await this.#workflowService.loadWorkflows();
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();
    }
}
