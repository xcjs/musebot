import { ImagesResponse, Prompt } from 'comfy-ui-client';
import { BaseMessageOptions, ButtonInteraction } from 'discord.js';
import sharp from 'sharp';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
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
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;
    #logger: ILogger;

    #interaction: ButtonInteraction;
    #workflow: IWorkflow;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction, workflow: IWorkflow) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;
        this.#logger = services.getLogger('ComfyUiUpscaleRenderTask');

        this.#interaction = interaction;
        this.#workflow = workflow;
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

        const content = `${this.#interaction.user.toString() || 'You'} ran a custom workflow: \`${renderRequest.label}\``;

        const renderRequests: Array<SerializableRenderRequest | null> = [];

        for (const imageAsBase64 of imagesAsBase64) {
            const defaults = this.#workflowService.getWorkflowDefaults(this.#workflow);
            const renderRequest = SerializableRenderRequest.fromSerializableRenderRequest(defaults);

            const image = sharp(Buffer.from(imageAsBase64, BufferEncoding.Base64));
            const imageMetadata = await image.metadata();

            renderRequest.refreshSeed();
            renderRequest.prompt = imageAsBase64;
            renderRequest.width = imageMetadata.width;
            renderRequest.height = imageMetadata.height;

            if(renderRequest.maxWidth !== undefined && renderRequest.maxHeight !== undefined) {
                const maxWidth = renderRequest.maxWidth;
                const maxHeight = renderRequest.maxHeight;
                let width = imageMetadata.width;
                let height = imageMetadata.height;

                if(width > maxWidth ) {
                    const ratio = maxWidth / width;
                    width = maxWidth;
                    height = Math.ceil(height * ratio);
                }

                if(height > maxHeight) {
                    const ratio = maxHeight / height;
                    width = Math.ceil(width * ratio);
                    height = maxHeight;
                }

                renderRequest.width = width;
                renderRequest.height = height;
            }

            renderRequests.push(renderRequest);

            prompts.push(this.#workflowService.renderWorkflow(this.#workflow, renderRequest));
        }

        const imagesResponse = await this.#comfyUiClient.render(prompts);

        const reply: BaseMessageOptions = { content };
        const exchange: IHttpExchange<SerializableRenderRequest[], ImagesResponse> = {
            request: renderRequests,
            response: imagesResponse
        };

        if (this.#environmentSettings.hasStableDiffusionOutputAsSeparateTask) {
            const replyTask = new ComfyUiReplyTask(this.#services, this.#interaction, reply, exchange);
            this.#taskQueue.add(replyTask);
        } else {
            await this.#comfyUiReplyService.reply(this.#interaction, reply, false, exchange);
        }
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
