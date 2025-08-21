import { Prompt } from 'comfy-ui-client';
import { Message } from 'discord.js';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { IReplyRenderTask } from '../../tasks/IReplyRenderTask.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { IRenderRequestMutator } from '../services/render-request-mutators/IRenderRequestMutator.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiReplyRenderTask extends ComfyUiBaseTask implements IReplyRenderTask {
    #logger: ILogger;

    #message: Message;
    #mutator: IRenderRequestMutator;

    constructor(services: IServiceContainer, message: Message, mutator: IRenderRequestMutator) {
        super(services);

        this.#logger = services.getLogger('ComfyUiReplyRenderTask');

        this.#message = message;
        this.#mutator = mutator;
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiReplyRenderTask...');

        const workflows = this.workflowService.workflows.filter(x =>
            x.type !== SupportedFeature.Txt2Txt);

        const renderRequests: SerializableRenderRequest[] = [];
        const prompts: Prompt[] = [];
        let numRenders = 1;
        let i = 0;

        do {
            const workflow = getRandomArrayEntry(workflows);
            this.#logger.info(`Using ${workflow.name} as the selected workflow.`);

            let renderRequest = this.workflowService.getWorkflowDefaults(workflow);
            renderRequest = await this.#mutator.mutate(renderRequest, this.#message, workflow);

            if (i === 0) {
                numRenders = renderRequest.num;
            }

            renderRequests.push(renderRequest);

            prompts.push(this.workflowService.renderWorkflow(workflow, renderRequest));

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
