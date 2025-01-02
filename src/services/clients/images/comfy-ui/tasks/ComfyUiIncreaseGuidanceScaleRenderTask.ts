import { ImagesResponse } from 'comfy-ui-client';
import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { ContentType } from '../../../../../enums/ContentType.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IIncreaseGuidanceScaleRenderTask } from '../../tasks/IIncreaseGuidanceScaleRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';

export class ComfyUiIncreaseGuidanceScaleRenderTask extends BaseTask implements IIncreaseGuidanceScaleRenderTask {
    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `ComfyUi_${this.#comfyUiClient.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiIncreaseGuidanceScaleRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing an ComfyUiIncreaseGuidanceScaleRenderTask...');

        await this.#workflowService.loadWorkflows();

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachments = this.#replyService.getAttachmentsByType(this.#interaction, imageTypes);
        const imageAsBase64Attachments = await this.#replyService.getAttachedImagesAsBase64(this.#interaction);

        if (imageAsBase64Attachments.length == 0) {
            this.#logger(LogLevel.Warning, 'No attachments were found - exiting the task.');
            return;
        }

        const workflow = getRandomArrayEntry(this.#workflowService.workflows);
        this.#logger(LogLevel.Info, `Using ${workflow} as the selected workflow.`);

        let renderRequest: SerializableRenderRequest;
        let cfgScaleValue: number;
        let imagesResponses: Array<ImagesResponse>;
        let i = 0;

        for (const imageAsBase64 in imageAsBase64Attachments) {
            renderRequest = SerializableRenderRequest.fromJson(imageAttachments[i].description);
            renderRequest.prompt = imageAsBase64;
            renderRequest.cfgScale += this.#environmentSettings.stableDiffusionGuidanceScaleInterval;

            cfgScaleValue = renderRequest.cfgScale;

            const prompt = this.#workflowService.renderWorkflow(workflow, renderRequest);

            imagesResponses.push(await this.#comfyUiClient.render(prompt));
            i++;
        }

        const imagesResponse = this.#comfyUiReplyService.flattenMultipleImagesResponses(imagesResponses);

        const content = `${this.#interaction.member} increased the guidance scale from ${cfgScaleValue
            - this.#environmentSettings.stableDiffusionGuidanceScaleInterval} to ${cfgScaleValue}.`;

        await this.#comfyUiReplyService.reply(this.#interaction, {
            request: renderRequest,
            response: imagesResponse
        }, content);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
