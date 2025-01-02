import { ImagesResponse } from 'comfy-ui-client';
import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { ContentType } from '../../../../../enums/ContentType.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IUpscaleRenderTask } from '../../tasks/IUpscaleRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { WorkflowType } from '../enums/WorkflowType.js';
import { IWorkflow } from '../models/IWorkflow.js';
import { IWorkflowService } from '../services/IWorkflowService.js';

export class ComfyUiUpscaleRenderTask extends BaseTask implements IUpscaleRenderTask {
    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `ComfyUi_${this.#comfyUiReplyService.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: ButtonInteraction) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiUpscaleRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a ComfyUiUpscaleRenderTask...');

        await this.#workflowService.loadWorkflows();

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachments = this.#replyService.getAttachmentsByType(this.#interaction, imageTypes);
        const imagesResponses: Array<ImagesResponse> = [];

        if(imageAttachments.length === 0) {
            await this.#replyService.replyWithError(this.#interaction);
        }

        const originalRenderRequest = SerializableRenderRequest.fromJson(imageAttachments[0].description);
        const imagesAsBase64 = await this.#replyService.getAttachedImagesAsBase64(this.#interaction);

        const templateKey = '{{ upscalerType }}';
        let content = `${this.#interaction.user} upscaled an image using ${templateKey} upscaler.`;

        for(const imageAsBase64 of imagesAsBase64) {
            const upscalingWorkflows = this.#workflowService.workflows.filter(x => x.type === WorkflowType.Upscaler);
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
                    + ` Make sure that ${WorkflowType.Upscaler}/design.json and ${WorkflowType.Upscaler}/detail.json`
                    + ` exist and accept a Base64 encoded image string in the prompt field.`
                );

                await this.#replyService.replyWithError(this.#interaction);
            }

            const renderRequest = new SerializableRenderRequest();
            renderRequest.prompt = imageAsBase64;

            const prompt = this.#workflowService.renderWorkflow(workflow, renderRequest);
            const imagesResponse = await this.#comfyUiClient.render(prompt);

            imagesResponses.push(imagesResponse);
        }

        const imagesResponse = this.#comfyUiReplyService.flattenMultipleImagesResponses(imagesResponses);

        await this.#comfyUiReplyService.reply(this.#interaction, {
            request: originalRenderRequest,
            response: imagesResponse
        }, content);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
