import { Prompt } from 'comfy-ui-client';
import { BaseMessageOptions, ButtonInteraction, Message, User } from 'discord.js';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry, getRandomInt } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IRetryRenderTask } from '../../tasks/IRetryRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { MultiMediaResponse } from '../extensions/MediaResponse.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiRetryAudioTask extends ComfyUiBaseTask implements IRetryRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;
    #logger: ILogger;

    #interaction: Message | ButtonInteraction;

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
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;
        this.#logger = services.getLogger('ComfyUiRetryAudioTask');

        this.#interaction = interaction;
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiRetryAudioTask...');

        const audioAttachments = this.#replyService.getAudioAttachments(this.#interaction);

        if (audioAttachments.length === 0) {
            this.#logger.warn('No attachments were found - exiting the task.');
            return;
        }

        const renderRequests: SerializableRenderRequest[] = [];
        const prompts: Prompt[] = [];
        let content: string;

        const username = this.#interaction.member !== null
            ? this.#replyService.mention(this.#interaction.member.user as User)
            : 'You';

        for (const audioAttachment of audioAttachments) {
            const renderRequest = SerializableRenderRequest.fromJson(audioAttachment.description);
            content = `${username} re-rendered \`${renderRequest.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);

            const workflows = this.#workflowService.workflows.filter(x =>
                x.type === SupportedFeature.Txt2Audio);

            const workflow = getRandomArrayEntry(workflows);
            const renderDefaults = this.#workflowService.getWorkflowDefaults(workflow);

            this.#logger.info(`Using ${workflow.name} as the selected workflow.`);

            renderRequest.prompt = renderRequest.prompt;
            renderRequest.refreshSeed();
            renderRequest.workflow = workflow.name;
            renderRequest.num = 1;
            renderRequest.cfgScale = renderDefaults.cfgScale;
            renderRequest.sampler = renderDefaults.sampler;
            renderRequest.scheduler = renderDefaults.scheduler;
            renderRequest.steps = renderDefaults.steps;

            if(renderRequest.durationMin !== undefined
                && renderRequest.durationMax !== undefined) {
                renderRequest.duration = getRandomInt(renderRequest.durationMin, renderRequest.durationMax);
            }

            if (renderRequest.workflow !== workflow.name) {
                renderRequest.height = renderDefaults.height;
                renderRequest.width = renderDefaults.width;
            }

            renderRequests.push(renderRequest);
            prompts.push(this.#workflowService.renderWorkflow(workflow, renderRequest));
        }

        const multiMediaResponse = await this.#comfyUiClient.renderMedia(prompts);

        const reply: BaseMessageOptions = { content };
        const exchange: IHttpExchange<SerializableRenderRequest[], MultiMediaResponse> = {
            request: renderRequests,
            response: multiMediaResponse
        };

        if (this.#environmentSettings.hasStableDiffusionOutputAsSeparateTask) {
            const replyTask = new ComfyUiReplyTask(this.#services, this.#interaction, reply, exchange, true);
            this.#taskQueue.add(replyTask);
        } else {
            await this.#comfyUiReplyService.reply(this.#interaction, reply, true, exchange);
        }
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
