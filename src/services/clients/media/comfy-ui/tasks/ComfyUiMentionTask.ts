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
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiMentionTask extends ComfyUiBaseTask {
    #logger: ILogger;
    #services: IServiceContainer;

    #message: Message;

    constructor(services: IServiceContainer, message: Message) {
        super(services);

        this.#logger = services.getLogger('ComfyUiMentionTask');

        this.#services = services;

        this.botInteraction = BotInteraction.Mention;

        this.#message = message;
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiMentionTask...');

        const workflow = getRandomArrayEntry(this.workflowService.workflows.filter(x =>
            x.type.startsWith('txt2')
            && x.type !== SupportedFeature.Txt2Txt));

        this.#logger.info(`Selected ${workflow.name} as the workflow.`);

        const defaultRenderRequest = this.workflowService.getWorkflowDefaults(workflow);
        const mutator = this.#services.getWorkflowMutator(BotInteraction.Mention, workflow);

        const renderRequests: SerializableRenderRequest[] = [];
        const prompts: Prompt[] = [];

        for (let i = 0; i < defaultRenderRequest.num; i++) {
            const renderRequest = await mutator.mutate(defaultRenderRequest, this.#message, workflow);
            const prompt = this.workflowService.renderWorkflow(workflow, renderRequest);

            renderRequests.push(renderRequest);
            prompts.push(prompt)
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
