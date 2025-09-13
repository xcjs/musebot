import { Prompt } from 'comfy-ui-client';
import { Message } from 'discord.js';

import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { IWorkflow } from '../models/IWorkflow.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiMessageTask extends ComfyUiBaseTask {
    #logger: ILogger;
    #services: IServiceContainer;

    #message: Message;

    constructor(services: IServiceContainer, message: Message) {
        super(services);

        this.#logger = services.getLogger('ComfyUiMentionTask');

        this.#services = services;

        this.#message = message;
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiMentionTask...');

        const textPrompt = this.replyService.getMessageWithoutBotMentions(this.#message);
        const renderRequests: SerializableRenderRequest[] = [];

        let interactionType = BotInteraction.Message;

        if(textPrompt.startsWith('{')) {
            interactionType = BotInteraction.JsonMessage;
        }

        let workflow: IWorkflow;
        let defaultRenderRequest: SerializableRenderRequest;

        switch(interactionType) {
            case BotInteraction.JsonMessage:
                const renderRequest = SerializableRenderRequest.fromJson(textPrompt);
                workflow = this.workflowService.workflows.find(x => x.name === renderRequest.workflow);
                defaultRenderRequest = renderRequest;
                break;
            default:
                workflow = getRandomArrayEntry(this.workflowService.workflows.filter(x =>
                    x.type.startsWith('txt2')
                    && x.type !== SupportedFeature.Txt2Txt));
                defaultRenderRequest = this.workflowService.getWorkflowDefaults(workflow);
                break;
        }

        this.#logger.info(`Selected ${workflow.name} as the workflow.`);

        const mutator = this.#services.getWorkflowMutator(interactionType, workflow);

        const prompts: Prompt[] = [];

        for (let i = 0; i < defaultRenderRequest.num; i++) {
            const renderRequest = await mutator.mutate(defaultRenderRequest, this.#message, workflow);

            if(renderRequest === null) {
                continue;
            }

            // The number comes from the defaultRenderRequest, but needs to be
            // reset to 1 here. This prevents multiple loops of requests
            // multiplying to a higher number.
            renderRequest.num = 1;

            const prompt = this.workflowService.renderWorkflow(workflow, renderRequest);

            renderRequests.push(renderRequest);
            prompts.push(prompt);
        }

        if(renderRequests.length === 0 || prompts.length === 0) {
            throw new Error('There are no actionable prompts found.');
        }

        const mediaCollectionResponse = await this.comfyUiClient.render(prompts);
        const exchange: IHttpExchange<SerializableRenderRequest[], MediaCollectionResponse> = {
            request: renderRequests,
            response: mediaCollectionResponse
        };

        await this.comfyUiReplyService.reply(this.#message, {}, false, exchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.replyService.replyWithError(this.#message);
        }
    }
}
