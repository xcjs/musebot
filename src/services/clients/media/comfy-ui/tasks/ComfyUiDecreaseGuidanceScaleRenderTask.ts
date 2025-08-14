import { Prompt } from 'comfy-ui-client';
import { BaseMessageOptions, ButtonInteraction } from 'discord.js';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IDecreaseGuidanceScaleRenderTask } from '../../tasks/IDecreaseGuidanceScaleRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiDecreaseGuidanceScaleRenderTask extends ComfyUiBaseTask implements IDecreaseGuidanceScaleRenderTask {
    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #logger: ILogger;

    #interaction: ButtonInteraction;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;

        this.#logger = services.getLogger('ComfyUiDecreaseGuidanceScaleRenderTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiDecreaseGuidanceScaleRenderTask...');

        const imageAttachments = this.#replyService.getImageAttachments(this.#interaction);

        if (imageAttachments.length == 0) {
            this.#logger.warn('No attachments were found - exiting the task.');
            return;
        }

        const renderRequests: Array<SerializableRenderRequest> = [];
        const prompts: Prompt[] = [];
        let cfgScaleValue: number;

        for (const imageAttachment of imageAttachments) {
            const renderRequest = SerializableRenderRequest.fromJson(imageAttachment.description);

            const workflow = this.#workflowService.workflows.find(x => x.name === renderRequest.workflow);

            this.#logger.info(`Using ${workflow.name} as the selected workflow.`);

            renderRequest.cfgScale -= this.#environmentSettings.stableDiffusionGuidanceScaleInterval;
            renderRequests.push(renderRequest);
            cfgScaleValue = renderRequest.cfgScale;

            prompts.push(this.#workflowService.renderWorkflow(workflow, renderRequest));
        }

        const imagesResponse = await this.#comfyUiClient.render(prompts);

        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const content = `${this.#interaction.member?.user.toString() || 'You'} decreased the guidance scale from ${cfgScaleValue
            + this.#environmentSettings.stableDiffusionGuidanceScaleInterval} to ${cfgScaleValue}.`;

        const reply: BaseMessageOptions = { content };
        const exchange: IHttpExchange<SerializableRenderRequest[], MediaCollectionResponse> = {
            request: renderRequests,
            response: imagesResponse
        };

        await this.#comfyUiReplyService.reply(this.#interaction, reply, false, exchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
