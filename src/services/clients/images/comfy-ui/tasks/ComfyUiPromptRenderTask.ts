import { ImagesResponse } from 'comfy-ui-client';
import { Message, MessageType } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IPromptRenderTask } from '../../tasks/IPromptRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { WorkflowType } from '../enums/WorkflowType.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiJsonRenderTask } from './ComfyUiJsonRenderTask.js';

export class ComfyUiPromptRenderTask extends ComfyUiBaseTask implements IPromptRenderTask {
    #services: IServiceContainer;

    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

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

        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
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

        if (prompt.charAt(0) === '{') {
            this.#taskQueue.add(new ComfyUiJsonRenderTask(
                this.#services,
                this.#message));
            return Promise.resolve();
        }

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type === WorkflowType.Txt2img
            || x.type === WorkflowType.Txt2vid);

        const renderRequests: Array<SerializableRenderRequest> = [];
        const imagesResponses: Array<ImagesResponse> = [];
        let numRenders = 1;
        let i = 0;

        do {
            const workflow = getRandomArrayEntry(workflows);

            this.#logger(LogLevel.Info, `Using ${workflow.name} as the selected workflow.`);

            const renderRequest = this.#workflowService.getWorkflowDefaults(workflow);
            numRenders = renderRequest.num;

            renderRequest.model = workflow.name;
            renderRequest.prompt = prompt;
            renderRequest.num = 1;
            renderRequest.refreshSeed();

            renderRequests.push(renderRequest);


            const workflowPrompt = this.#workflowService.renderWorkflow(workflow, renderRequest);

            imagesResponses.push(await this.#comfyUiClient.render(workflowPrompt));

            i++;
        } while(i < numRenders);


        const imagesResponse = this.#comfyUiReplyService.flattenMultipleImagesResponses(imagesResponses);

        await this.#comfyUiReplyService.reply(this.#message, {
            request: renderRequests,
            response: imagesResponse
        });
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
