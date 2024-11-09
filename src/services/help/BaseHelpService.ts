import { Client } from 'discord.js';

import { IActionRows } from '../clients/chat/discord/components/buttonRows/IActionRows.js';
import { IReplyService } from '../clients/chat/IReplyService.js';
import { IServiceContainer } from '../IServiceContainer.js';

export abstract class BaseHelpService {
    protected discordClient: Client;
    protected replyService: IReplyService;

    constructor(services: IServiceContainer) {
        this.discordClient = services.discordClient;
        this.replyService = services.replyService;
    }

    protected buildHelpArticleFromActionRows(actionRows: IActionRows): string {
        let helpArticle = '';
        actionRows.build();

        actionRows.buttons.forEach(button => {
            helpArticle += `* **\`${button.label}\` ${button.title}**`;
            helpArticle += ` - ${button.helpText}\n\n`;
        });

        return helpArticle;
    }
}
