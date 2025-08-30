import { Prompt } from 'comfy-ui-client';
import { Message } from 'discord.js';

import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { IReplyRenderTask } from '../../tasks/IReplyRenderTask.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { IWorkflowMutator } from '../services/workflow-mutators/IWorkflowMutator.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiMentionTask extends ComfyUiBaseTask implements IReplyRenderTask {
    #logger: ILogger;

    #message: Message;
    #mutator: IWorkflowMutator;

    constructor(services: IServiceContainer, message: Message) {
        super(services);

        this.#logger = services.getLogger('ComfyUiMentionTask');

        this.#message = message;

        this.#mutator = services.getWorkflowMutator(BotInteraction.Mention, this.workflow);
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiMentionTask...');

        const renderRequests: SerializableRenderRequest[] = [];
        const prompts: Prompt[] = [];
        let numRenders = 1;
        let i = 0;

        do {
            let renderRequest = this.workflowService.getWorkflowDefaults(this.workflow);
            renderRequest = await this.#mutator.mutate(renderRequest, this.#message, this.workflow);

            if (i === 0) {
                numRenders = renderRequest.num;
            }

            renderRequests.push(renderRequest);

            prompts.push(this.workflowService.renderWorkflow(this.workflow, renderRequest));

            i++;
        } while (i < numRenders);

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
