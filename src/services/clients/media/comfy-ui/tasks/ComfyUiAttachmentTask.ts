import { Attachment, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { LlmChatMessageAttachment } from '../../../llm/ollama/models/LlmChatMessageAttachment.js';
import { OllamaClient } from '../../../llm/ollama/OllamaClient.js';
import { ILlmChatMessageFactory } from '../../../llm/services/ILlmChatMessageFactory.js';
import { IMemoryService } from '../../../llm/services/IMemoryService.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { WorkflowNotFoundError } from '../WorkflowNotFoundError.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

type DiscordReplyService = IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

export class ComfyUiAttachmentTask extends ComfyUiBaseTask {
    readonly #workflowService: IWorkflowService;
    readonly #comfyUiClient: ComfyUiClient;
    readonly #comfyUiReplyService: ComfyUiReplyService;
    readonly #replyService: DiscordReplyService;
    readonly #featureService: IFeatureService;
    readonly #llmChatMessageFactory: ILlmChatMessageFactory<Message>;
    readonly #memoryService: IMemoryService;
    readonly #ollamaClient: OllamaClient;

    readonly #message: Message;
    readonly #prompt: string;

    constructor(
        services: IBotServiceContainer,
        message: Message,
        prompt: string) {
        super(services);
        this.logger = services.getLogger('ComfyUiAttachmentTask');

        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.getReplyService();
        this.#featureService = services.featureService;
        this.#llmChatMessageFactory = services.getLlmChatMessageFactory<Message>();
        this.#memoryService = services.getMemoryService();
        this.#ollamaClient = services.ollamaClient;

        this.#message = message;
        this.#prompt = prompt;
    }

    override async process(): Promise<void> {
        await super.process();

        const existingAttachments = [...this.#message.attachments.values()];

        if (existingAttachments.length >= DiscordConstants.MaxAttachmentsPerMessage) {
            this.logger.info('Skipping media attachment; message already has the maximum number of attachments.');
            return;
        }

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type.startsWith('txt2')
            && x.type != SupportedFeature.Txt2Txt);

        const workflow = getRandomArrayEntry(workflows);

        if(workflow === null) {
            throw WorkflowNotFoundError;
        }

        this.logger.info(`Using ${workflow.name} as the selected workflow.`);

        const renderRequest = this.#workflowService.getWorkflowDefaults(workflow);
        renderRequest.prompt = this.#prompt.trim();
        renderRequest.workflow = workflow.name;
        renderRequest.refreshSeed();
        renderRequest.refreshDuration();

        const prompt = this.#workflowService.renderWorkflow(workflow, renderRequest);
        const imagesResponse = await this.#comfyUiClient.render([prompt]);

        const exchange: IHttpExchange<SerializableRenderRequest[], MediaCollectionResponse> = {
            request: [renderRequest],
            response: imagesResponse
        };

        await this.#comfyUiReplyService.reply(this.#message,
            { content: this.#message.content, files: existingAttachments },
            true, exchange);

        await this.#storeImageMemory(imagesResponse);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#message);
        }
    }

    async #storeImageMemory(imagesResponse: MediaCollectionResponse): Promise<void> {
        if (!this.#featureService.hasFeature(SupportedFeature.Vision)) {
            return;
        }

        if (!this.#memoryService.isEnabled) {
            return;
        }

        const ownerUserId = await this.#resolveOwnerUserId();
        if (ownerUserId === null) {
            return;
        }

        try {
            const attachments = await this.#interpretRenderedImages(imagesResponse);
            if (attachments.length === 0) {
                return;
            }

            const botLlmChatMessage = this.#llmChatMessageFactory.createFromLlmResponse(this.#prompt, this.#message);
            botLlmChatMessage.attachments = attachments;

            await this.#memoryService.store(botLlmChatMessage, ownerUserId);
            this.logger.info(`Stored ${attachments.length} interpreted bot-generated image(s) as memory for user ${ownerUserId}.`);
        } catch (error) {
            this.logger.error('Failed to store bot-generated image memory:', error);
        }
    }

    async #interpretRenderedImages(imagesResponse: MediaCollectionResponse): Promise<LlmChatMessageAttachment[]> {
        const attachments: LlmChatMessageAttachment[] = [];
        const base64Images: string[] = [];

        for (const mediaContainers of Object.values(imagesResponse)) {
            for (const container of mediaContainers) {
                if (container.blob.size === 0) {
                    continue;
                }

                const buffer = Buffer.from(await container.blob.arrayBuffer());
                base64Images.push(buffer.toString('base64'));
            }
        }

        if (base64Images.length === 0) {
            return attachments;
        }

        const interpretation = await this.#ollamaClient.interpretImages(base64Images, `The bot generated this image in response to the prompt: "${this.#prompt}"`);

        for (let i = 0; i < base64Images.length; i++) {
            attachments.push({
                filename: `generated-${i}.png`,
                url: '',
                type: 'image',
                interpretation
            });
        }

        return attachments;
    }

    async #resolveOwnerUserId(): Promise<string | null> {
        try {
            if (this.#message.reference === null) {
                return null;
            }

            const reference = await this.#message.fetchReference();
            return reference.author.id;
        } catch (error) {
            this.logger.warn('Failed to resolve the triggering message author; bot image memory will not be stored.', error);
            return null;
        }
    }
}
