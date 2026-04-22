import { Attachment, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { TaskQueueStrategy } from '../../../../../enums/TaskQueueStrategy.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ResourceType } from '../../../../parallelization/ResourceType.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { OllamaClient } from '../../../llm/ollama/OllamaClient.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';

export abstract class ComfyUiBaseTask extends BaseTask<void> {
    override get taskChannel(): string {
        return this.parallelizationStrategy.getTaskChannel(this.resourceType, this.comfyUiClient.host);
    }

    override get resourceType(): ResourceType {
        return ResourceType.Media;
    }

    readonly environmentSettings: IEnvironmentSettings;
    readonly comfyUiClient: ComfyUiClient;
    readonly workflowService: IWorkflowService;
    readonly comfyUiReplyService: ComfyUiReplyService;
    readonly replyService: IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;
    readonly #featureService: IFeatureService;
    readonly #ollamaClient: OllamaClient;

    constructor(services: IServiceContainer) {
        super(services);

        this.environmentSettings = services.environmentSettings;
        this.comfyUiClient = services.comfyUiClient;
        this.workflowService = services.workflowService;
        this.comfyUiReplyService = services.comfyUiReplyService;
        this.replyService = services.getReplyService();
        this.#featureService = services.featureService;
        this.#ollamaClient = services.ollamaClient;
    }

    override async process(): Promise<void> {
        await super.process();

        this.logger.info('Loading workflows...');
        await this.workflowService.loadWorkflows();
    }

    override async postProcess(): Promise<void> {
        if(this.environmentSettings.taskQueueStrategy === TaskQueueStrategy.Serial
            && this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            await this.#ollamaClient.free();
        }

        await super.postProcess();
    }
}
