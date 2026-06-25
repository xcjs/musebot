import { Prompt } from 'comfy-ui-client';
import { Attachment, AttachmentBuilder, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';

type DiscordReplyService = IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { WorkflowNotFoundError } from '../WorkflowNotFoundError.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiInteractionTask extends ComfyUiBaseTask {
    readonly #services: IBotServiceContainer;

    readonly #replyService: DiscordReplyService;

    readonly #interaction: ButtonInteraction;

    constructor(services: IBotServiceContainer, interaction: ButtonInteraction) {
        super(services);
        this.logger = services.getLogger('ComfyUiInteractionTask');

        this.#services = services;

        this.#replyService = services.getReplyService();

        this.#interaction = interaction;
    }

    override async process(): Promise<void> {
        await super.process();

        const inputRenderRequests = await this.#readRenderRequests();
        const outputRenderRequests: SerializableRenderRequest[] = [];

        const workflows = inputRenderRequests.map(renderRequest => this.workflowService.workflows
            .find(workflow => workflow.name === renderRequest.workflow))
            .filter(workflow => workflow !== undefined);

        if(workflows.length === 0) {
            // Some interactions do not require an existing SerializableRenderRequest.
            // If we've made it this far, assume the interaction creates a novel
            // piece of media and provide it a workflow and render request to work from.
            const newMediaWorkflow = getRandomArrayEntry(this.workflowService.workflows.filter(x =>
                x.type.startsWith('txt2')
                && x.type !== SupportedFeature.Txt2Txt));

            if(newMediaWorkflow === null) {
                throw WorkflowNotFoundError;
            }

            const newMediaRenderRequest = this.workflowService.getWorkflowDefaults(newMediaWorkflow);
            newMediaRenderRequest.workflow = newMediaWorkflow.name;

            workflows.push(newMediaWorkflow);
            inputRenderRequests.push(newMediaRenderRequest);
        }

        let i = 0;
        const prompts: Prompt[] = [];
        let content: string = '';
        let additionalAttachments: AttachmentBuilder[] = [];

        for (const workflow of workflows) {
            if (i >= inputRenderRequests.length) {
                break;
            }

            const mutator = this.#services.getWorkflowMutator(this.#interaction.customId as BotInteraction, workflow);

            const renderRequest = await mutator.mutate(inputRenderRequests[i], this.#interaction, workflow);
            let mutatedWorkflow = workflow;

            // Some mutators can select a new workflow. TODO: This should probably be handled within the mutator.
            if (renderRequest.workflow !== workflow.name) {
                const potentialWorkflow = this.workflowService.workflows.find(x => x.name === renderRequest.workflow);

                if (potentialWorkflow === undefined) {
                    throw WorkflowNotFoundError;
                }

                mutatedWorkflow = potentialWorkflow;
            }

            const prompt = this.workflowService.renderWorkflow(mutatedWorkflow, renderRequest);

            content = mutator.contentMessage;
            additionalAttachments = additionalAttachments.concat(mutator.additionalAttachments);

            prompts.push(prompt);
            outputRenderRequests.push(renderRequest);
            i++;
        }

        const mediaCollectionResponse = await this.comfyUiClient.render(prompts);
        const exchange: IHttpExchange<SerializableRenderRequest[], MediaCollectionResponse> = {
            request: outputRenderRequests,
            response: mediaCollectionResponse
        };

        if (additionalAttachments.length > DiscordConstants.MaxMediaAttachmentsPerMessage - 1) {
            this.logger.warn('The maximum media attachment count has been exceeded:',
                additionalAttachments.length,
                DiscordConstants.MaxMediaAttachmentsPerMessage - 1);

            additionalAttachments.length = DiscordConstants.MaxMediaAttachmentsPerMessage - 1;
        }

        await this.comfyUiReplyService.reply(this.#interaction, {
            content,
            files: additionalAttachments
        }, false, exchange);
    }

    async #readRenderRequests(): Promise<SerializableRenderRequest[]> {
        // Prefer the dedicated state JSON file attachment.
        const stateAttachments = this.#replyService.getAttachmentsByName(this.#interaction, DiscordConstants.StateFileName);

        if (stateAttachments.length > 0) {
            const stateAttachment = stateAttachments[0];
            const response = await fetch(stateAttachment.url);
            const buffer = Buffer.from(await response.arrayBuffer());
            const json = buffer.toString('utf-8');
            const parsed = JSON.parse(json) as SerializableRenderRequest[];

            return parsed.map(item => SerializableRenderRequest.fromSerializableRenderRequest(item));
        }

        // Legacy fallback: read SerializableRenderRequest from attachment descriptions.
        const attachmentsWithRenderRequests = this.#replyService.getAttachments(this.#interaction)
            .filter(attachment => attachment.description?.length || 0 > 0);

        return attachmentsWithRenderRequests
            .map(attachment => SerializableRenderRequest.fromJson(attachment.description || ''));
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.replyService.replyWithError(this.#interaction);
        }
    }
}
