import { Prompt } from 'comfy-ui-client';
import { Message, MessageType } from 'discord.js';

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
import { IReplyRenderTask } from '../../tasks/IReplyRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiReplyRenderTask extends ComfyUiBaseTask implements IReplyRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;

    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;
    #logger: ILogger;

    #message: Message;


    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(services: IServiceContainer, message: Message) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;

        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;

        this.#taskQueue = services.taskQueue;
        this.#logger = services.getLogger('ComfyUiReplyRenderTask');

        this.#message = message;
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiReplyRenderTask...');

        const prompt = this.#message.type === MessageType.Reply
            ? `${((await this.#getAllAntecedentPrompts()).join(' '))} ${this.#message.content}`.trim()
            : this.#replyService.getMessageWithoutBotMentions(this.#message);

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type === SupportedFeature.Txt2Img
            || x.type === SupportedFeature.Txt2Vid);

        const renderRequests: SerializableRenderRequest[] = [];
        const prompts: Prompt[] = [];
        let numRenders = 1;
        let i = 0;

        do {
            const workflow = getRandomArrayEntry(workflows);

            this.#logger.info(`Using ${workflow.name} as the selected workflow.`);

            const renderRequest = this.#workflowService.getWorkflowDefaults(workflow);

            if(i === 0) {
                numRenders = renderRequest.num;
            }

            renderRequest.workflow = workflow.name;
            renderRequest.prompt = prompt;
            renderRequest.num = 1;
            renderRequest.refreshSeed();

            renderRequests.push(renderRequest);

            prompts.push(this.#workflowService.renderWorkflow(workflow, renderRequest));
            i++;
        } while(i < numRenders);

        const imagesResponse = await this.#comfyUiClient.render(prompts);
        const exchange: IHttpExchange<SerializableRenderRequest[], MediaCollectionResponse> = {
            request: renderRequests,
            response: imagesResponse
        };

        if (this.#environmentSettings.hasStableDiffusionOutputAsSeparateTask) {
            const replyTask = new ComfyUiReplyTask(this.#services, this.#message, { }, exchange);
            this.#taskQueue.add(replyTask);
        } else {
            await this.#comfyUiReplyService.reply(this.#message, { }, false, exchange);
        }
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
