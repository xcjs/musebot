import { Attachment, ButtonInteraction, Client, Message, MessageReaction } from 'discord.js';

import { IActionRows } from '../clients/chat/discord/components/buttonRows/IActionRows.js';
import { IReplyService } from '../clients/chat/IReplyService.js';
import { IServiceContainer } from '../IServiceContainer.js';

type DiscordReplyService = IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

export abstract class BaseHelpService {
    protected discordClient: Client;
    protected replyService: DiscordReplyService;

    constructor(services: IServiceContainer) {
        this.discordClient = services.discordClient;
        this.replyService = services.getReplyService();
    }

    protected async buildHelpArticleFromActionRows(actionRows: IActionRows): Promise<string> {
        let helpArticle = '';

        if(!actionRows.isAsync) {
            actionRows.build();
        } else {
            await actionRows.buildAsync();
        }

        actionRows.buttons.forEach(button => {
            helpArticle += `* **\`${button.label}\` ${button.title}**`;
            helpArticle += ` - ${button.helpText}\n\n`;
        });

        return helpArticle;
    }
}
