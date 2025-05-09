import { ImagesResponse } from 'comfy-ui-client';
import { BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IAttachRenderTask } from '../../tasks/IAttachRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiAttachRenderTask extends ComfyUiBaseTask implements IAttachRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;
    #logger: ILogger;

    #reply: BaseMessageOptions;
    #prompt: string;

    #interaction: Message | ButtonInteraction;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions,
        prompt: string) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;
        this.#logger = services.getLogger('ComfyUiAttachRenderTask');

        this.#interaction = interaction;
        this.#reply = reply;
        this.#prompt = prompt;
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiAttachRenderTask...');

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type === SupportedFeature.Txt2Img
            || x.type === SupportedFeature.Txt2Vid);

        const workflow = getRandomArrayEntry(workflows);

        this.#logger.info(`Using ${workflow.name} as the selected workflow.`);

        const renderRequest = this.#workflowService.getWorkflowDefaults(workflow);
        renderRequest.prompt = this.#prompt.trim();
        renderRequest.refreshSeed();

        const prompt = this.#workflowService.renderWorkflow(workflow, renderRequest);
        const imagesResponse = await this.#comfyUiClient.render([prompt]);

        const reply: BaseMessageOptions = { content: this.#reply.content };
        const exchange: IHttpExchange<SerializableRenderRequest[], ImagesResponse> = {
            request: [renderRequest],
            response: imagesResponse
        };

        if(this.#environmentSettings.hasStableDiffusionOutputAsSeparateTask) {
            const replyTask = new ComfyUiReplyTask(this.#services, this.#interaction, reply, exchange, true);
            this.#taskQueue.add(replyTask);
        } else {
            await this.#comfyUiReplyService.reply(this.#interaction, reply, true, exchange);
        }
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
