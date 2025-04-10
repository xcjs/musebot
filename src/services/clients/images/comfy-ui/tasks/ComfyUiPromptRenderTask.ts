import { Prompt } from 'comfy-ui-client';
import { Message, MessageType } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IPromptRenderTask } from '../../tasks/IPromptRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { WorkflowType } from '../enums/WorkflowType.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiPromptRenderTask extends ComfyUiBaseTask implements IPromptRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;

    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #message: Message;

    #logger;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(services: IServiceContainer, message: Message) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;

        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#message = message;

        this.#logger = new Logger(services.environmentSettings.isProduction, 'ComfyUiPromptRenderTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger(LogLevel.Info, 'Processing a ComfyUiPromptRenderTask...');

        const prompt = this.#message.type === MessageType.Reply
            ? `${((await this.#getAllAntecedentPrompts()).join(' '))} ${this.#message.content}`.trim()
            : this.#replyService.getMessageWithoutBotMentions(this.#message);

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type === WorkflowType.Txt2img
            || x.type === WorkflowType.Txt2vid);

        const renderRequests: SerializableRenderRequest[] = [];
        const prompts: Prompt[] = [];
        let numRenders = 1;
        let i = 0;

        do {
            const workflow = getRandomArrayEntry(workflows);

            this.#logger(LogLevel.Info, `Using ${workflow.name} as the selected workflow.`);

            const renderRequest = this.#workflowService.getWorkflowDefaults(workflow);

            if(i === 0) {
                numRenders = renderRequest.num;
            }

            renderRequest.model = workflow.name;
            renderRequest.prompt = prompt;
            renderRequest.num = 1;
            renderRequest.refreshSeed();

            renderRequests.push(renderRequest);

            prompts.push(this.#workflowService.renderWorkflow(workflow, renderRequest));
            i++;
        } while(i < numRenders);

        const imagesResponse = await this.#comfyUiClient.render(prompts);
        const replyTask = new ComfyUiReplyTask(this.#services, this.#message, { }, {
            request: renderRequests,
            response: imagesResponse
        });

        this.#taskQueue.add(replyTask);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#message);
        }
    }

    async #getAllAntecedentPrompts(): Promise<Array<string>> {
        const prompts: Array<string> = [];
        let currentMessage = this.#message;

        while (currentMessage.reference !== null) {
            const antecedentMessage = await currentMessage.fetchReference();

            if (antecedentMessage.content !== null && antecedentMessage.content.length > 0) {
                prompts.push(this.#replyService.getMessageWithoutBotMentions(antecedentMessage));
            }

            currentMessage = antecedentMessage;
        }

        return prompts.reverse();
    }
}
