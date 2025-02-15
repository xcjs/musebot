import { ImagesResponse } from 'comfy-ui-client';
import { AttachmentBuilder, ButtonInteraction, Message } from 'discord.js';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IReplyTask } from '../../../chat/tasks/IReplyTask.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';

export class ComfyUiReplyTask extends BaseTask implements IReplyTask {
    get taskChannel(): string {
        return 'Discord';
    }

    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;

    #interaction: Message | ButtonInteraction;
    #renderExchange: IHttpExchange<Array<SerializableRenderRequest>, ImagesResponse>;
    #content: string | null;
    #additionalAttachments: Array<AttachmentBuilder>;
    #isEdit: boolean;

    constructor(services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        renderExchange: IHttpExchange<Array<SerializableRenderRequest>, ImagesResponse>,
        content: string | null = null,
        additionalAttachments: Array<AttachmentBuilder> = [],
        isEdit: boolean = false) {
        super(services);

        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;
        this.#renderExchange = renderExchange;
        this.#content = content;
        this.#additionalAttachments = additionalAttachments;
        this.#isEdit = isEdit;
    }

    async process(): Promise<void> {
        // In case the bot takes too long to reply to a delayed response and the
        // reply token expires, force a normal reply to prevent running a task
        // that may never succeed.
        if(this.numAttempts > 0 && this.#isEdit) {
            await this.#comfyUiReplyService.reply(this.#interaction, this.#renderExchange, this.#content, this.#additionalAttachments, false);
            return;
        }

        await this.#comfyUiReplyService.reply(this.#interaction, this.#renderExchange, this.#content, this.#additionalAttachments, this.#isEdit);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
