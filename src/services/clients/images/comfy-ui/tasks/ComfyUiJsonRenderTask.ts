import { Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IJsonRenderTask } from '../../tasks/IJsonRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { WorkflowType } from '../enums/WorkflowType.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiJsonRenderTask extends ComfyUiBaseTask implements IJsonRenderTask {
    #environmentSettings: IEnvironmentSettings;

    #discordClient: DiscordClient;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;

    #message: Message;

    #logger;

    override get taskChannel(): string {
        return `ComfyUi_${this.#comfyUiClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        message: Message) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#message = message;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiJsonRenderTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger(LogLevel.Info, 'Processing a ComfyUiJsonRenderTask...');

        const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        const prompt = this.#message.content.replaceAll(botMention, '').trim();

        let renderRequest: SerializableRenderRequest;

        try {
            renderRequest = SerializableRenderRequest.fromJson(prompt);
        } catch {
           await this.#message.reply('You call that JSON? My grandmother could knit better JSON.');
           return;
        }

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type === WorkflowType.Txt2img
            || x.type === WorkflowType.Txt2vid);

        const workflow = workflows.find(x => x.name === renderRequest.model);

        if(renderRequest.seed === -1) {
            renderRequest.refreshSeed();
        }

        if(renderRequest.num > DiscordConstants.MaxAttachmentsPerMessage) {
            renderRequest.num = DiscordConstants.MaxAttachmentsPerMessage;
        }

        const workflowPrompt = this.#workflowService.renderWorkflow(workflow, renderRequest);
        const imagesResponse = await this.#comfyUiClient.render(workflowPrompt);

        const exchange = {
            request: [renderRequest],
            response: imagesResponse
        };

        await this.#comfyUiReplyService.reply(this.#message, exchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
