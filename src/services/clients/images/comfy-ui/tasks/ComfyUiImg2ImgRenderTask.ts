import { Prompt } from 'comfy-ui-client';
import { ButtonInteraction } from 'discord.js';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IImg2ImgRenderTask } from '../../tasks/IImg2ImgRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflow } from '../models/IWorkflow.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiImg2ImgRenderTask extends ComfyUiBaseTask implements IImg2ImgRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #interaction: ButtonInteraction;
    #workflow: IWorkflow;

    #logger: ILogger;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction, workflow: IWorkflow) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#interaction = interaction;
        this.#workflow = workflow;

        this.#logger = services.getLogger('ComfyUiUpscaleRenderTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiUpscaleRenderTask...');

        const imageAttachments = this.#replyService.getImageAttachments(this.#interaction);
        const prompts: Prompt[] = [];

        if (imageAttachments.length === 0) {
            await this.#replyService.replyWithError(this.#interaction);
        }

        const imagesAsBase64 = await this.#replyService.getAttachedImagesAsBase64(this.#interaction);
        const renderRequest = this.#workflowService.getWorkflowDefaults(this.#workflow);

        const content = `${this.#interaction.user.username || 'You'} ran a custom workflow: \`${renderRequest.label}\``;

        const renderRequests: Array<SerializableRenderRequest | null> = [];
        let i = 0;

        for (const imageAsBase64 of imagesAsBase64) {
            const description = imageAttachments[i].description;

            if (description?.length > 0) {
                renderRequests.push(SerializableRenderRequest.fromJson(description));
            } else {
                renderRequests.push(null);
            }

            renderRequest.prompt = imageAsBase64;
            prompts.push(this.#workflowService.renderWorkflow(this.#workflow, renderRequest));
            i++;
        }

        const imagesResponse = await this.#comfyUiClient.render(prompts);

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
