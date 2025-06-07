import { BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';

import { IServiceContainer } from '../../../../IServiceContainer.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { IReplyService } from '../../IReplyService.js';
import { IReplyTask } from '../../tasks/IReplyTask.js';

export class ReplyTask extends BaseTask<void> implements IReplyTask {
    get taskChannel(): string {
        return 'Discord';
    }

    #replyService: IReplyService;

    #interaction: Message | ButtonInteraction;
    #reply: BaseMessageOptions;
    #isEdit: boolean;

    constructor(services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions,
        isEdit: boolean = false) {
        super(services);

        this.#replyService = services.replyService;

        this.#interaction = interaction;
        this.#reply = reply;
        this.#isEdit = isEdit;
    }

    async process(): Promise<void> {
        await this.#replyService.reply(this.#interaction, this.#reply, this.#isEdit);
    }
}
