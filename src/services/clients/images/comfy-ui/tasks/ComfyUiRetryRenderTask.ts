import { Prompt } from 'comfy-ui-client';
import { ButtonInteraction, Message, User } from 'discord.js';

import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IRetryRenderTask } from '../../tasks/IRetryRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiRetryRenderTask extends ComfyUiBaseTask implements IRetryRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #interaction: Message | ButtonInteraction;

    #logger: ILogger;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: Message | ButtonInteraction) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#interaction = interaction;

        this.#logger = services.getLogger('ComfyUiRetryRenderTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiRetryRenderTask...');

        const imageAttachments = this.#replyService.getImageAttachments(this.#interaction);

        if (imageAttachments.length === 0) {
            this.#logger.warning('No attachments were found - exiting the task.');
            return;
        }

        const renderRequests: SerializableRenderRequest[] = [];
        const prompts: Prompt[] = [];
        let content: string;

        const username = this.#interaction.member !== null
                    ? this.#replyService.mention(this.#interaction.member.user as User)
                    : 'You';

        for (const imageAttachment of imageAttachments) {
            const renderRequest = SerializableRenderRequest.fromJson(imageAttachment.description);
            content = `${username} re-rendered \`${renderRequest.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);

            const workflows = this.#workflowService.workflows.filter(x =>
                x.type === SupportedFeature.Txt2Img
                || x.type === SupportedFeature.Txt2Vid);

            const workflow = getRandomArrayEntry(workflows);
            const renderDefaults = this.#workflowService.getWorkflowDefaults(workflow);

            this.#logger.info(`Using ${workflow.name} as the selected workflow.`);

            renderRequest.prompt = renderRequest.prompt;
            renderRequest.refreshSeed();
            renderRequest.model = workflow.name;
            renderRequest.num = 1;
            renderRequest.cfgScale = renderDefaults.cfgScale;
            renderRequest.sampler = renderDefaults.sampler;
            renderRequest.scheduler = renderDefaults.scheduler;
            renderRequest.steps = renderDefaults.steps;

            if(renderRequest.model !== workflow.name) {
                renderRequest.height = renderDefaults.height;
                renderRequest.width = renderDefaults.width;
            }

            renderRequests.push(renderRequest);
            prompts.push(this.#workflowService.renderWorkflow(workflow, renderRequest));
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
