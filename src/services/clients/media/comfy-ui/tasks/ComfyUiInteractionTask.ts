import { Prompt } from 'comfy-ui-client';
import { AttachmentBuilder, ButtonInteraction } from 'discord.js';

import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiInteractionTask extends ComfyUiBaseTask {
    #services: IServiceContainer;

    #replyService: IReplyService;

    #interaction: ButtonInteraction;

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);
        this.logger = services.getLogger('ComfyUiInteractionTask');

        this.#services = services;

        this.#replyService = services.replyService;

        this.#interaction = interaction;
    }

    override async process(): Promise<void> {
        await super.process();

        const attachments = this.#replyService.getAttachments(this.#interaction)
            .filter(attachment => attachment.description.length > 0);

        if(attachments.length === 0) {
            // No attachments means there's no work to do.
            return;
        }

        const renderRequests = attachments
            .map(attachment => SerializableRenderRequest.fromJson(attachment.description));

        const workflows = renderRequests.map(renderRequest => this.workflowService.workflows
            .find(workflow => workflow.name === renderRequest.workflow))
            .filter(workflow => workflow !== undefined);

        let i = 0;
        const prompts: Prompt[] = [];
        let content: string = '';
        let additionalAttachments: AttachmentBuilder[] = [];

        for (const workflow of workflows) {
            if(i >= renderRequests.length) {
                break;
            }

            const mutator = this.#services.getWorkflowMutator(this.#interaction.customId as BotInteraction, workflow);
            const renderRequest = await mutator.mutate(renderRequests[i], this.#interaction, workflow);
            const prompt = this.workflowService.renderWorkflow(workflow, renderRequest);

            content = mutator.contentMessage;
            additionalAttachments = additionalAttachments.concat(mutator.additionalAttachments);

            prompts.push(prompt);
            i++;
        }

        const mediaCollectionResponse = await this.comfyUiClient.render(prompts);
        const exchange: IHttpExchange<SerializableRenderRequest[], MediaCollectionResponse> = {
            request: renderRequests,
            response: mediaCollectionResponse
        };

        if (additionalAttachments.length > DiscordConstants.MaxAttachmentsPerMessage) {
            this.logger.warn('The maximum attachment count has been exceeded:',
                additionalAttachments.length,
                DiscordConstants.MaxAttachmentsPerMessage);

            additionalAttachments.length = DiscordConstants.ContentMaxLength;
        }

        await this.comfyUiReplyService.reply(this.#interaction, {
            content,
            files: additionalAttachments
        }, false, exchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.replyService.replyWithError(this.#interaction);
        }
    }
}
