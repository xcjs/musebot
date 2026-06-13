import { Attachment, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { IHelpService } from '../../../help/IHelpService.js';
import { IBotServiceContainer } from "../../../IBotServiceContainer.js"
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { IReplyService } from '../../chat/IReplyService.js';

type DiscordReplyService = IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

export class ShowHelpTask extends BaseTask<void> {
    get taskChannel(): string {
        return 'Discord';
    }

    #helpService: IHelpService;
    #replyService: DiscordReplyService;

    #interaction: ButtonInteraction;

    constructor(services: IBotServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#helpService = services.helpService;
        this.#replyService = services.getReplyService();

        this.#interaction = interaction;
    }

    async process(): Promise<void> {
        await this.#replyService.reply(this.#interaction, { content: await this.#helpService.buildHelpArticle(this.#interaction) }, false);
    }
}
