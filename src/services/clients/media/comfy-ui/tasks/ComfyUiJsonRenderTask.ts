import { Client as DiscordClient, Message } from 'discord.js';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { IJsonRenderTask } from '../../tasks/IJsonRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiJsonRenderTask extends ComfyUiBaseTask implements IJsonRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #message: Message;

    #logger: ILogger;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(services: IServiceContainer, message: Message) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#message = message;

        this.#logger = services.getLogger('ComfyUiJsonRenderTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiJsonRenderTask...');

        const botMention = this.#message.mentions.members?.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        const prompt = this.#message.content.replaceAll(botMention, '').trim();

        let renderRequest: SerializableRenderRequest;

        try {
            renderRequest = SerializableRenderRequest.fromJson(prompt);
            renderRequest.height = Math.ceil(renderRequest.height);
            renderRequest.width = Math.ceil(renderRequest.width);
        } catch {
           await this.#message.reply('You call that JSON? My grandmother could knit better JSON.');
           return;
        }

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type === SupportedFeature.Txt2Img
            || x.type === SupportedFeature.Txt2Vid);

        const workflow = workflows.find(x => x.name === renderRequest.workflow);

        if(renderRequest.seed === -1) {
            renderRequest.refreshSeed();
        }

        if(renderRequest.num > DiscordConstants.MaxAttachmentsPerMessage) {
            renderRequest.num = DiscordConstants.MaxAttachmentsPerMessage;
        }

        const workflowPrompt = this.#workflowService.renderWorkflow(workflow, renderRequest);
        const imagesResponse = await this.#comfyUiClient.render([workflowPrompt]);

        const exchange = {
            request: [renderRequest],
            response: imagesResponse
        };

        const replyTask = new ComfyUiReplyTask(this.#services, this.#message, { }, exchange);

        this.#taskQueue.add(replyTask);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
