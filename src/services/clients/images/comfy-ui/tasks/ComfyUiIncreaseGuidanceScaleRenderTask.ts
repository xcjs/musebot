import { Prompt } from 'comfy-ui-client';
import { ButtonInteraction } from 'discord.js';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IIncreaseGuidanceScaleRenderTask } from '../../tasks/IIncreaseGuidanceScaleRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiIncreaseGuidanceScaleRenderTask extends ComfyUiBaseTask implements IIncreaseGuidanceScaleRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #interaction: ButtonInteraction;

    #logger: ILogger;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#interaction = interaction;

        this.#logger = services.getLogger('ComfyUiIncreaseGuidanceScaleRenderTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing an ComfyUiIncreaseGuidanceScaleRenderTask...');

        const imageAttachments = this.#replyService.getImageAttachments(this.#interaction);

        if (imageAttachments.length == 0) {
            this.#logger.warning('No attachments were found - exiting the task.');
            return;
        }

        const renderRequests: Array<SerializableRenderRequest> = [];
        const prompts: Prompt[] = [];
        let cfgScaleValue: number;

        for (const imageAttachment of imageAttachments) {
            const renderRequest = SerializableRenderRequest.fromJson(imageAttachment.description);

            const workflow = this.#workflowService.workflows.find(x => x.name === renderRequest.model);

            this.#logger.info(`Using ${workflow.name} as the selected workflow.`);

            renderRequest.cfgScale += this.#environmentSettings.stableDiffusionGuidanceScaleInterval;
            renderRequests.push(renderRequest);
            cfgScaleValue = renderRequest.cfgScale;

            prompts.push(this.#workflowService.renderWorkflow(workflow, renderRequest));
        }

        const imagesResponse = await this.#comfyUiClient.render(prompts);

        const content = `${this.#interaction.member.user.username || 'You'} increased the guidance scale from ${cfgScaleValue
            - this.#environmentSettings.stableDiffusionGuidanceScaleInterval} to ${cfgScaleValue}.`;

        const replyTask = new ComfyUiReplyTask(this.#services, this.#interaction, { content }, {
            request: renderRequests,
            response: imagesResponse
        });

        this.#taskQueue.add(replyTask);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
