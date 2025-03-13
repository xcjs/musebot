import { BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';

import { IServiceContainer } from '../../../../IServiceContainer.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { IReplyService } from '../../IReplyService.js';
import { IReplyTask } from '../../tasks/IReplyTask.js';

export class ReplyTask extends BaseTask implements IReplyTask {
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
        // Usually if an interaction fails, it's because the edit token has
        // expired, which occurs within ~10-15 minutes after the reply is
        // delayed. If this happens, no editReply call will ever work on that
        // interaction. We want to fallback to a reply to the reacted message.
        // This is usually an issue for video inferences which can exceed this
        // time limit, but will be an issue for any long inference.
        if(this.#isEdit
            && this.numAttempts > 1
            && this.#interaction instanceof ButtonInteraction) {
            this.#isEdit = false;
        }

        await this.#replyService.reply(this.#interaction, this.#reply, this.#isEdit);
    }
}
