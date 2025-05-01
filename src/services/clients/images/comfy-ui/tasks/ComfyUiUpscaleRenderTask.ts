import { Prompt } from 'comfy-ui-client';
import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IUpscaleRenderTask } from '../../tasks/IUpscaleRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflow } from '../models/IWorkflow.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiUpscaleRenderTask extends ComfyUiBaseTask implements IUpscaleRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiUpscaleRenderTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger(LogLevel.Info, 'Processing a ComfyUiUpscaleRenderTask...');

        const imageAttachments = this.#replyService.getImageAttachments(this.#interaction);
        const prompts: Prompt[] = [];

        if(imageAttachments.length === 0) {
            await this.#replyService.replyWithError(this.#interaction);
        }

        const imagesAsBase64 = await this.#replyService.getAttachedImagesAsBase64(this.#interaction);

        const templateKey = '{{ upscalerType }}';
        let content = `${this.#interaction.user || 'You'} upscaled an image using ${templateKey} upscaler.`;

        const renderRequests: Array<SerializableRenderRequest | null> = [];
        let i = 0;

        for(const imageAsBase64 of imagesAsBase64) {
            const description = imageAttachments[i].description;

            if(description?.length > 0) {
                renderRequests.push(SerializableRenderRequest.fromJson(description));
            } else {
                renderRequests.push(null);
            }

            const upscalingWorkflows = this.#workflowService.workflows.filter(x => x.type === SupportedFeature.Img2ImgUpscaling);
            let workflow: IWorkflow;

            if (this.#interaction.customId === BotInteraction.UpscaleDetail) {
                workflow = upscalingWorkflows.find(x => x.name.toLowerCase().includes('detail'));
                content = content.replace(templateKey, 'a realistic');
            } else {
                workflow = upscalingWorkflows.find(x => x.name.toLowerCase().includes('design'));
                content = content.replace(templateKey, 'an artistic');
            }

            if (workflow === undefined) {
                this.#logger(LogLevel.Error, `The ${this.#interaction.customId} workflow doesn't exist.`
                    + ` Make sure that ${SupportedFeature.Img2ImgUpscaling}/design.json and ${SupportedFeature.Img2ImgUpscaling}/detail.json`
                    + ` exist and accept a Base64 encoded image string in the prompt field.`
                );

                await this.#replyService.replyWithError(this.#interaction);
            }

            const renderRequest = new SerializableRenderRequest();
            renderRequest.prompt = imageAsBase64;

            prompts.push(this.#workflowService.renderWorkflow(workflow, renderRequest));
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
