import { Client as DiscordClient, Message } from 'discord.js';
import { Logger } from 'meklog';

import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IPromptRenderTask } from '../../tasks/IPromptRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { WorkflowType } from '../enums/WorkflowType.js';
import { IWorkflowService } from '../services/IWorkflowService.js';

export class PromptRenderTask extends BaseTask implements IPromptRenderTask {
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

        this.#discordClient = services.discordClient;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#message = message;

        this.#logger = new Logger(services.environmentSettings.isProduction, PromptRenderTask.name);
    }

    override async process(): Promise<void> {
        const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        const prompt = this.#message.content.replaceAll(botMention, '').trim();

        await this.#workflowService.loadWorkflows();

        const workflows = this.#workflowService.workflows.filter(x => x.type === WorkflowType.Txt2img);
        const selectedWorkflow = getRandomArrayEntry(workflows);

        const renderRequest = this.#workflowService.getWorkflowDefaults(selectedWorkflow);
        renderRequest.model = selectedWorkflow.name;
        renderRequest.prompt = prompt;
        renderRequest.refreshSeed();

        const workflowPrompt = this.#workflowService.renderWorkflow(selectedWorkflow, renderRequest);

        const images = await this.#comfyUiClient.render(workflowPrompt);
        await this.#comfyUiReplyService.reply(this.#message, {
            request: renderRequest,
            response: images });
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
