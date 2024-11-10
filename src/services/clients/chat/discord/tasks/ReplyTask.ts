import { AttachmentBuilder, ButtonInteraction, Message } from 'discord.js';

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
    #content: string;
    #attachments: Array<AttachmentBuilder>;
    #isEdit: boolean;

    constructor(services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        content: string | null,
        attachments: Array<AttachmentBuilder> = [],
        isEdit: boolean = false) {
        super(services);

        this.#replyService = services.replyService;

        this.#interaction = interaction;
        this.#content = content;
        this.#attachments = attachments;
        this.#isEdit = isEdit;
    }

    async process(): Promise<void> {
        await this.#replyService.reply(this.#interaction, this.#content, this.#attachments, this.#isEdit);
    }
}
