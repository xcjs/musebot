import { Prompt } from 'comfy-ui-client';
import { ButtonInteraction } from 'discord.js';

import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { IChannelableTask } from '../../../chat/tasks/IChannelableTask.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiMentionTask extends ComfyUiBaseTask implements IChannelableTask {
    #logger: ILogger;
    #services: IServiceContainer;

    #interaction: ButtonInteraction;

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#logger = services.getLogger('ComfyUiInteractionTask');

        this.#services = services;

        this.#interaction = interaction;
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiInteractionTask...');

        this.workflow = getRandomArrayEntry(this.workflowService.workflows.filter(x =>
            x.type.startsWith('txt2')
            && x.type !== SupportedFeature.Txt2Txt));

        this.#logger.info(`Selected ${this.workflow.name} as the workflow.`);

        this.mutator = this.#services.getWorkflowMutator(this.#interaction.id as BotInteraction, this.workflow);

        const renderRequests: SerializableRenderRequest[] = [];
        const prompts: Prompt[] = [];
        let numRenders = 1;
        let i = 0;

        do {
            let renderRequest = this.workflowService.getWorkflowDefaults(this.workflow);
            renderRequest = await this.mutator.mutate(renderRequest, this.#interaction, this.workflow);

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

        await this.comfyUiReplyService.reply(this.#interaction, {}, false, exchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.replyService.replyWithError(this.#interaction);
        }
    }
}
