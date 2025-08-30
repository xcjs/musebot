import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflow } from '../models/IWorkflow.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { IWorkflowMutator } from '../services/workflow-mutators/IWorkflowMutator.js';

export abstract class ComfyUiBaseTask extends BaseTask<void> {
    override get taskChannel(): string {
        return `${this.environmentSettings.stableDiffusionTaskChannel}_${this.comfyUiClient.host}`;
    }

    environmentSettings: IEnvironmentSettings;
    comfyUiClient: ComfyUiClient;
    workflowService: IWorkflowService;
    comfyUiReplyService: ComfyUiReplyService;
    replyService: IReplyService;

    botInteraction: BotInteraction;
    workflow: IWorkflow;
    mutator: IWorkflowMutator;

    #logger: ILogger;

    constructor(services: IServiceContainer) {
        super(services);

        this.environmentSettings = services.environmentSettings;
        this.comfyUiClient = services.comfyUiClient;
        this.workflowService = services.workflowService;
        this.comfyUiReplyService = services.comfyUiReplyService;
        this.replyService = services.replyService;

        this.#logger = services.getLogger('ComfyUiBaseTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Loading workflows...');
        await this.workflowService.loadWorkflows();
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();
    }
}
