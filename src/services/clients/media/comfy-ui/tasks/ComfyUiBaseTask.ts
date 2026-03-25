import { Attachment, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ResourceType } from '../../../../parallelization/ResourceType.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';

export abstract class ComfyUiBaseTask extends BaseTask<void> {
    override get taskChannel(): string {
        return this.parallelizationStrategy.getTaskChannel(this.resourceType, this.comfyUiClient.host);
    }

    override get resourceType(): ResourceType | null {
        return ResourceType.Media;
    }

    environmentSettings: IEnvironmentSettings;
    comfyUiClient: ComfyUiClient;
    workflowService: IWorkflowService;
    comfyUiReplyService: ComfyUiReplyService;
    replyService: IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

    constructor(services: IServiceContainer) {
        super(services);

        this.environmentSettings = services.environmentSettings;
        this.comfyUiClient = services.comfyUiClient;
        this.workflowService = services.workflowService;
        this.comfyUiReplyService = services.comfyUiReplyService;
        this.replyService = services.getReplyService();
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
