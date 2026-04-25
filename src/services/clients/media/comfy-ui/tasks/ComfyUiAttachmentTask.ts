import { Attachment, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';

type DiscordReplyService = IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

import { ComfyUiClient } from '../ComfyUiClient.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { WorkflowNotFoundError } from '../WorkflowNotFoundError.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiAttachmentTask extends ComfyUiBaseTask {
    readonly #workflowService: IWorkflowService;
    readonly #comfyUiClient: ComfyUiClient;
    readonly #comfyUiReplyService: ComfyUiReplyService;
    readonly #replyService: DiscordReplyService;

    readonly #message: Message;
    readonly #prompt: string;

    constructor(
        services: IServiceContainer,
        message: Message,
        prompt: string) {
        super(services);
        this.logger = services.getLogger('ComfyUiAttachmentTask');

        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.getReplyService();

        this.#message = message;
        this.#prompt = prompt;
    }

    override async process(): Promise<void> {
        await super.process();

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

        await this.#comfyUiReplyService.reply(this.#message, { content: this.#message.content }, true, exchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
