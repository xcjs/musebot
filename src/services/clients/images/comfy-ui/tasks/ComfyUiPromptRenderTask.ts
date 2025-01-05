import { Client as DiscordClient, Message, MessageType } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { TaskQueue } from '../../../../tasks/TaskQueue.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IPromptRenderTask } from '../../tasks/IPromptRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { WorkflowType } from '../enums/WorkflowType.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiJsonRenderTask } from './ComfyUiJsonRenderTask.js';

export class ComfyUiPromptRenderTask extends BaseTask implements IPromptRenderTask {
    #services: IServiceContainer;

    #discordClient: DiscordClient;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #taskQueue: TaskQueue;

    #message: Message;

    #logger;

    override get taskChannel(): string {
        return `ComfyUi_${this.#comfyUiClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        message: Message) {
        super(services);

        this.#services = services;

        this.#discordClient = services.discordClient;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#message = message;

        this.#logger = new Logger(services.environmentSettings.isProduction, 'ComfyUiPromptRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a ComfyUiPromptRenderTask...');

        const prompt = this.#message.type === MessageType.Reply
            ? `${((await this.#getAllAntecedentPrompts()).join(' '))} ${this.#message.content}`.trim()
            : this.#filterBotMentions(this.#message.content).trim();

        if(prompt.charAt(0) === '{') {
            this.#taskQueue.add(new ComfyUiJsonRenderTask(
                this.#services,
                this.#message));
            return;
        }

        await this.#workflowService.loadWorkflows();

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type === WorkflowType.Txt2img
            || x.type === WorkflowType.Txt2vid);

        const workflow = getRandomArrayEntry(workflows);

        this.#logger(LogLevel.Info, `Using ${workflow.name} as the selected workflow.`);

        const renderRequest = this.#workflowService.getWorkflowDefaults(workflow);
        renderRequest.model = workflow.name;
        renderRequest.prompt = prompt;
        renderRequest.refreshSeed();

        const workflowPrompt = this.#workflowService.renderWorkflow(workflow, renderRequest);

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

    #filterBotMentions(messageContent: string | null): string {
        const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        return messageContent.replaceAll(botMention, '').trim();
    }

    async #getAllAntecedentPrompts(): Promise<Array<string>> {
        const prompts: Array<string> = [];
        let currentMessage = this.#message;

        while (currentMessage.reference !== null) {
            const antecedentMessage = await currentMessage.fetchReference();

            if (antecedentMessage.content !== null && antecedentMessage.content.length > 0) {
                prompts.push(this.#filterBotMentions(antecedentMessage.content.trim()));
            }

            currentMessage = antecedentMessage;
        }

        return prompts.reverse();
    }
}
