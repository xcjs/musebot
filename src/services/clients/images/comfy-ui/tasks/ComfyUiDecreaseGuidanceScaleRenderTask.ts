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
import { IDecreaseGuidanceScaleRenderTask } from '../../tasks/IDecreaseGuidanceScaleRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';

export class ComfyUiDecreaseGuidanceScaleRenderTask extends BaseTask implements IDecreaseGuidanceScaleRenderTask {
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

        this.#logger = new Logger(services.environmentSettings.isProduction, 'ComfyUiDecreaseGuidanceScaleRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a ComfyUiDecreaseGuidanceScaleRenderTask...');

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#replyService.getAttachmentsByType(this.#interaction, imageTypes)[0];

        await this.#workflowService.loadWorkflows();

        const workflow = getRandomArrayEntry(this.#workflowService.workflows);

        this.#logger(LogLevel.Info, `Using ${workflow} as the selected workflow.`);

        const renderRequest = SerializableRenderRequest.fromJson(imageAttachment.description);

        renderRequest.cfgScale -= this.#environmentSettings.stableDiffusionGuidanceScaleInterval;
        const cfgScaleValue = renderRequest.cfgScale;

        const prompt = this.#workflowService.renderWorkflow(workflow, renderRequest);

        const imagesResponse = await this.#comfyUiClient.render(prompt);

        const content = `${this.#interaction.member} decreased the guidance scale from ${cfgScaleValue
            + this.#environmentSettings.stableDiffusionGuidanceScaleInterval} to ${cfgScaleValue}.`;

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
