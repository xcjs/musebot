import { Prompt } from 'comfy-ui-client';
import { Attachment, BaseMessageOptions, ButtonInteraction, Message, MessageReaction } from 'discord.js';
import sharp from 'sharp';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';

type DiscordReplyService = IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

import { ComfyUiClient } from '../ComfyUiClient.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { IWorkflow } from '../models/IWorkflow.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiImg2ImgInteractionTask extends ComfyUiBaseTask {
    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: DiscordReplyService;

    #interaction: ButtonInteraction;
    #workflow: IWorkflow;

    constructor(services: IServiceContainer, interaction: ButtonInteraction, workflow: IWorkflow) {
        super(services);
        this.logger = services.getLogger('ComfyUiImg2ImgInteractionTask');

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.getReplyService();

        this.#interaction = interaction;
        this.#workflow = workflow;
    }

    override async process(): Promise<void> {
        await super.process();

        const imageAttachments = this.#replyService.getImageAttachments(this.#interaction);
        const prompts: Prompt[] = [];

        if (imageAttachments.length === 0) {
            await this.#replyService.replyWithError(this.#interaction);
        }

        const imagesAsBase64 = await this.#replyService.getAttachedImagesAsBase64(this.#interaction);
        const renderRequest = this.#workflowService.getWorkflowDefaults(this.#workflow);

        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const content = `${this.#interaction.member?.user.toString() || 'You'} ran a custom workflow: \`${renderRequest.label}\``;

        const renderRequests: Array<SerializableRenderRequest | null> = [];

        for (const imageAsBase64 of imagesAsBase64) {
            const defaults = this.#workflowService.getWorkflowDefaults(this.#workflow);
            const renderRequest = SerializableRenderRequest.fromSerializableRenderRequest(defaults);

            const image = sharp(Buffer.from(imageAsBase64, BufferEncoding.Base64));
            const imageMetadata = await image.metadata();

            renderRequest.refreshSeed();
            renderRequest.image = imageAsBase64;
            renderRequest.width = imageMetadata.width;
            renderRequest.height = imageMetadata.height;

            if(renderRequest.maxWidth !== undefined && renderRequest.maxHeight !== undefined) {
                const maxWidth = renderRequest.maxWidth;
                const maxHeight = renderRequest.maxHeight;
                let width = imageMetadata.width;
                let height = imageMetadata.height;

                if(width > maxWidth ) {
                    const ratio = maxWidth / width;
                    width = maxWidth;
                    height = Math.ceil(height * ratio);
                }

                if(height > maxHeight) {
                    const ratio = maxHeight / height;
                    width = Math.ceil(width * ratio);
                    height = maxHeight;
                }

                renderRequest.width = width;
                renderRequest.height = height;
            }

            renderRequests.push(renderRequest);

            prompts.push(this.#workflowService.renderWorkflow(this.#workflow, renderRequest));
        }

        const imagesResponse = await this.#comfyUiClient.render(prompts);

        const reply: BaseMessageOptions = { content };
        const exchange: IHttpExchange<SerializableRenderRequest[], MediaCollectionResponse> = {
            request: renderRequests,
            response: imagesResponse
        };

        await this.#comfyUiReplyService.reply(this.#interaction, reply, false, exchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
