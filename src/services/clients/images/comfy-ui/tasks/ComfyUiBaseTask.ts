import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';

export abstract class ComfyUiBaseTask extends BaseTask<void> {
    comfyUiClient: ComfyUiClient;

    #workflowService: IWorkflowService;

    #logger: ILogger;

    constructor(services: IServiceContainer) {
        super(services);

        this.comfyUiClient = services.comfyUiClient;

        this.#workflowService = services.workflowService;

        this.#logger = services.getLogger('ComfyUiBaseTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Loading workflows...');
        await this.#workflowService.loadWorkflows();
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();
    }
}
