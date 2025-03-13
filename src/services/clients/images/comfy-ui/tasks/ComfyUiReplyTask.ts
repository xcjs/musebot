import { ImagesResponse } from 'comfy-ui-client';
import { BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';

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
    #reply: BaseMessageOptions;
    #renderExchange: IHttpExchange<Array<SerializableRenderRequest>, ImagesResponse>;

    constructor(services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions,
        renderExchange: IHttpExchange<Array<SerializableRenderRequest>, ImagesResponse>) {
        super(services);

        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;
        this.#reply = reply;
        this.#renderExchange = renderExchange;
    }

    async process(): Promise<void> {
        let bypassEdit = false;

        // In case the bot takes too long to reply to a delayed response and the
        // reply token expires, force a normal reply to prevent running a task
        // that may never succeed.
        if(this.numAttempts > 0 && this.#interaction instanceof ButtonInteraction) {
            bypassEdit = true;
        }

        await this.#comfyUiReplyService.reply(this.#interaction, this.#reply, bypassEdit, this.#renderExchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
