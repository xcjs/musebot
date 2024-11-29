import { Interaction } from 'discord.js';

import { BaseHelpService } from '../../help/BaseHelpService.js';
import { IHelpService } from '../../help/IHelpService.js';
import { IServiceContainer } from '../../IServiceContainer.js';
import { LargeLanguageModelActionRow } from '../chat/discord/components/buttonRows/LargeLanguageModelActionRow.js';
import { IReplyService } from '../chat/IReplyService.js';

export class TextHelpService extends BaseHelpService implements IHelpService {
    #services: IServiceContainer;

    #replyService: IReplyService;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#replyService = services.replyService;
    }

    buildHelpArticle(interaction: Interaction): string {
        let helpArticle: string = this.#replyService.mention(interaction.user)
            + '\n\n'
            + `# Musebot Help`
            + '\n\n'
            + 'Thanks for using Musebot! This instance of Musebot is configured as a large language model service.'
            + '\n\n'
            + 'You can interact with this chatbot by mentioning it with'
            + ` ${this.replyService.mention(this.discordClient.user)} followed by the message you want it to reply to.`
            + ' Additionally, there are various button-based interactions you can use after interacting with the bot at least once: '
            + '\n\n';

        const actionRows = new LargeLanguageModelActionRow(this.#services);
        helpArticle += this.buildHelpArticleFromActionRows(actionRows);

        return helpArticle;
    }
}
