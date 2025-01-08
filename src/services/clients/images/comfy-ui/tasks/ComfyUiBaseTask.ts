import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';

export abstract class ComfyUiBaseTask extends BaseTask {
    comfyUiClient: ComfyUiClient;

    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;

    #logger;

    constructor(services: IServiceContainer) {
        super(services);

        this.comfyUiClient = services.comfyUiClient;

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiBaseTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger(LogLevel.Info, 'Loading workflows...');
        await this.#workflowService.loadWorkflows();
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();
    }
}
