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
    #isEdit: boolean;

    #isReplyConstructed: boolean = false;

    constructor(services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions,
        renderExchange: IHttpExchange<Array<SerializableRenderRequest>, ImagesResponse>,
        isEdit: boolean = false) {
        super(services);

        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;
        this.#reply = reply;
        this.#renderExchange = renderExchange;
        this.#isEdit = isEdit;
    }

    override async process(): Promise<void> {
        await super.process();

        await this.#comfyUiReplyService.reply(this.#interaction, this.#reply, this.#isEdit, this.#renderExchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
