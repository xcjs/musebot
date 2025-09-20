import { ButtonInteraction } from 'discord.js';

import { IHelpService } from '../../../help/IHelpService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { IReplyService } from '../../chat/IReplyService.js';

export class ShowHelpTask extends BaseTask<void> {
    get taskChannel(): string {
        return 'Discord';
    }

    #helpService: IHelpService;
    #replyService: IReplyService;

    #interaction: ButtonInteraction;

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#helpService = services.helpService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;
    }

    async process(): Promise<void> {
        await this.#replyService.reply(this.#interaction, { content: await this.#helpService.buildHelpArticle(this.#interaction) }, false);
    }
}
