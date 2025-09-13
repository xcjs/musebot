import { Prompt } from 'comfy-ui-client';
import { ButtonInteraction } from 'discord.js';

import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiInteractionTask extends ComfyUiBaseTask {
    #logger: ILogger;

    #services: IServiceContainer;

    #replyService: IReplyService;

    #interaction: ButtonInteraction;

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#logger = services.getLogger('ComfyUiInteractionTask');

        this.#services = services;

        this.#replyService = services.replyService;

        this.#interaction = interaction;
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiInteractionTask...');

        const attachments = this.#replyService.getAttachments(this.#interaction)
            .filter(attachment => attachment.description.length > 0);

        const renderRequests = attachments
            .map(attachment => SerializableRenderRequest.fromJson(attachment.description));

        const workflows = renderRequests.map(renderRequest => this.workflowService.workflows
            .find(workflow => workflow.name === renderRequest.workflow))
            .filter(workflow => workflow !== undefined);

        let i = 0;
        const prompts: Prompt[] = [];
        let content: string = '';

        for (const workflow of workflows) {
            if(i >= renderRequests.length) {
                break;
            }

            const mutator = this.#services.getWorkflowMutator(this.#interaction.customId as BotInteraction, workflow);
            const renderRequest = await mutator.mutate(renderRequests[i], this.#interaction, workflow);
            const prompt = this.workflowService.renderWorkflow(workflow, renderRequest);

            content = mutator.contentMessage;

            prompts.push(prompt);
            i++;
        }

        const mediaCollectionResponse = await this.comfyUiClient.render(prompts);
        const exchange: IHttpExchange<SerializableRenderRequest[], MediaCollectionResponse> = {
            request: renderRequests,
            response: mediaCollectionResponse
        };

        await this.comfyUiReplyService.reply(this.#interaction, { content }, false, exchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.replyService.replyWithError(this.#interaction);
        }
    }
}
