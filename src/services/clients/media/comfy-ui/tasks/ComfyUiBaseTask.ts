import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ApiResourceType } from '../../../../parallelization/ApiResourceType.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';

export abstract class ComfyUiBaseTask extends BaseTask<void> {
    override get taskChannel(): string {
        return this.parallelizationStrategy.getTaskChannel(ApiResourceType.Media, this.comfyUiClient.host);
    }

    environmentSettings: IEnvironmentSettings;
    comfyUiClient: ComfyUiClient;
    workflowService: IWorkflowService;
    comfyUiReplyService: ComfyUiReplyService;
    replyService: IReplyService;

    constructor(services: IServiceContainer) {
        super(services);

        this.environmentSettings = services.environmentSettings;
        this.comfyUiClient = services.comfyUiClient;
        this.workflowService = services.workflowService;
        this.comfyUiReplyService = services.comfyUiReplyService;
        this.replyService = services.replyService;
    }

    override async process(): Promise<void> {
        await super.process();

        this.logger.info('Loading workflows...');
        await this.workflowService.loadWorkflows();
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();
    }
}
