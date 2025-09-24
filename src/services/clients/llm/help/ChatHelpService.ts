import { Interaction } from 'discord.js';

import nodePackage from '../../../../../package.json' with { type: 'json' };
import { IEnvironmentSettings } from '../../../environment-settings/IEnvironmentSettings.js';
import { BaseHelpService } from '../../../help/BaseHelpService.js';
import { IHelpService } from '../../../help/IHelpService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ChatActionRow } from '../../chat/discord/components/buttonRows/ChatActionRow.js';
import { ChatConfirmClearActionRow } from '../../chat/discord/components/buttonRows/ChatConfirmClearActionRow.js';
import { DiscordConstants } from '../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../chat/IReplyService.js';

export class ChatHelpService extends BaseHelpService implements IHelpService {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #replyService: IReplyService;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#replyService = services.replyService;
    }

    async buildHelpArticle(interaction: Interaction): Promise<string> {
        const applicationName = this.#environmentSettings.applicationName;

        let helpArticle = `# ${applicationName} Help`
            + '\n\n'
            + `Thanks for using ${applicationName} v${nodePackage.version}, ${this.#replyService.mention(interaction.user)}!`
            + ` This instance of ${applicationName} is configured as a large language model service.`
            + ` For more information on ${applicationName} or to test the latest version of it, visit the [XCJS Discord](<${DiscordConstants.InviteLink}>).`
            + '\n\n'
            + 'You can interact with this chatbot by mentioning it with'
            + ` ${this.replyService.mention(this.discordClient.user)} followed by the message you want it to reply to.`
            + ' Additionally, there are various button-based interactions you can use after interacting with the bot at least once: '
            + '\n\n';

        helpArticle += await this.buildHelpArticleFromActionRows(new ChatActionRow(this.#services));
        helpArticle += await this.buildHelpArticleFromActionRows(new ChatConfirmClearActionRow(this.#services));

        return helpArticle;
    }
}
