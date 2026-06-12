import { Prompt } from 'comfy-ui-client';
import { Attachment, ButtonInteraction, Message, MessageReaction, MessageType } from 'discord.js';

import { BotInteraction } from '../../../../../enums/BotInteraction.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { IReplyService } from '../../../chat/IReplyService.js';

type DiscordReplyService = IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { IWorkflow } from '../models/IWorkflow.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiMessageTask extends ComfyUiBaseTask {
    readonly #services: IBotServiceContainer;

    readonly #featureService: IFeatureService;
    readonly #replyService: DiscordReplyService;

    readonly #message: Message;

    constructor(services: IBotServiceContainer, message: Message) {
        super(services);
        this.logger = services.getLogger('ComfyUiMessageTask');

        this.#services = services;

        this.#featureService = services.featureService;
        this.#replyService = services.getReplyService();

        this.#message = message;
    }

    override async process(): Promise<void> {
        await super.process();

        const textPrompt = this.replyService.getMessageWithoutBotMentions(this.#message);
        const renderRequests: SerializableRenderRequest[] = [];

        let interactionType = BotInteraction.Message;

        // Default to getting images from the current message.
        let imageAttachments = this.#replyService.getImageAttachments(this.#message);
        let imagesAsBase64: string[] = [];

        // If images are included in the current message, go ahead and encode
        // them.
        if(imageAttachments.length > 0) {
            imagesAsBase64 = await this.#replyService.getAttachedImagesAsBase64(this.#message);
        }

        if(this.#message === null) {
            return;
        }

        if(this.#message.type === MessageType.Reply) {
            if (this.#featureService.hasFeature(SupportedFeature.ContextualImg2Img)) {
                const previousMessage = await this.#replyService.getPreviousMessage(this.#message);

                if(previousMessage !== null) {
                    imageAttachments = this.#replyService.getImageAttachments(previousMessage);

                    if(imageAttachments.length > 0) {
                        interactionType = BotInteraction.ContextualReply;
                        imagesAsBase64 = await this.#replyService.getAttachedImagesAsBase64(previousMessage);
                    } else {
                        interactionType = BotInteraction.Reply;
                    }
                }
            }
            else {
                interactionType = BotInteraction.Reply;
            }
        } else if(textPrompt.startsWith('{')) {
            interactionType = BotInteraction.JsonMessage;
        } else if(imageAttachments.length > 0) {
            if(textPrompt.length > 0 && this.#featureService.hasFeature(SupportedFeature.ContextualImg2Img)) {
                interactionType = BotInteraction.ImageMessageWithPrompt;
            } else {
                interactionType = BotInteraction.ImageMessage;
            }
        }

        this.logger.info('Setting the interaction type as:', interactionType);

        let workflow: IWorkflow | null;
        let defaultRenderRequest: SerializableRenderRequest;

        switch(interactionType) {
            case BotInteraction.ImageMessage:
                await this.comfyUiReplyService.replyWithImageActionRows(this.#message, imageAttachments);
                return;
            case BotInteraction.ContextualReply:
            case BotInteraction.ImageMessageWithPrompt:
                workflow = getRandomArrayEntry(this.workflowService.workflows.filter(
                    x => x.type === SupportedFeature.ContextualImg2Img));

                if(workflow === null) {
                    return;
                }

                defaultRenderRequest = this.workflowService.getWorkflowDefaults(workflow);
                defaultRenderRequest.num = imageAttachments.length;
                break;
            case BotInteraction.JsonMessage:
                defaultRenderRequest = SerializableRenderRequest.fromJson(textPrompt);
                workflow = this.workflowService.workflows.find(x => x.name === defaultRenderRequest.workflow) || null;
                break;
            default:
                workflow = getRandomArrayEntry(this.workflowService.workflows.filter(x =>
                    x.type.startsWith('txt2')
                    && x.type !== SupportedFeature.Txt2Txt));

                if (workflow === null) {
                    return;
                }

                defaultRenderRequest = this.workflowService.getWorkflowDefaults(workflow);
                break;
        }

        if (workflow === null) {
            return;
        }

        this.logger.info(`Selected ${workflow.name} as the workflow.`);

        const mutator = this.#services.getWorkflowMutator(interactionType, workflow);

        const prompts: Prompt[] = [];
        let content = '';

        for (let i = 0; i < defaultRenderRequest.num; i++) {
            defaultRenderRequest.image = imagesAsBase64[i];

            if (workflow === null) {
                continue;
            }

            const renderRequest = await mutator.mutate(defaultRenderRequest, this.#message, workflow);

            // Some mutators can select a different workflow.
            workflow = this.workflowService.workflows.find(x => x.name === renderRequest.workflow) || null;

            if(renderRequest === null || workflow == null) {
                continue;
            }

            // The number comes from the defaultRenderRequest, but needs to be
            // reset to 1 here. This prevents multiple loops of requests
            // multiplying to a higher number.
            renderRequest.num = 1;

            const prompt = this.workflowService.renderWorkflow(workflow, renderRequest);

            renderRequests.push(renderRequest);
            prompts.push(prompt);
            content = mutator.contentMessage;
        }

        if(renderRequests.length === 0 || prompts.length === 0) {
            throw new Error('There are no actionable prompts found.');
        }

        const mediaCollectionResponse = await this.comfyUiClient.render(prompts);
        const exchange: IHttpExchange<SerializableRenderRequest[], MediaCollectionResponse> = {
            request: renderRequests,
            response: mediaCollectionResponse
        };

        await this.comfyUiReplyService.reply(this.#message, { content }, false, exchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.replyService.replyWithError(this.#message);
        }
    }
}
