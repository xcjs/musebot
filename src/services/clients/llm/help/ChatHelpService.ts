import { Attachment, ButtonInteraction, Interaction, Message, MessageReaction } from 'discord.js';

import nodePackage from '../../../../../package.json' with { type: 'json' };
import { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../features/IFeatureService.js';
import { BaseHelpService } from '../../../help/BaseHelpService.js';
import { IHelpService } from '../../../help/IHelpService.js';
import { IBotServiceContainer } from "../../../IBotServiceContainer.js"
import { ChatActionRow } from '../../chat/discord/components/buttonRows/ChatActionRow.js';
import { ChatConfirmClearActionRow } from '../../chat/discord/components/buttonRows/ChatConfirmClearActionRow.js';
import { DiscordConstants } from '../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../chat/IReplyService.js';

type DiscordReplyService = IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

export class ChatHelpService extends BaseHelpService implements IHelpService {
    readonly #services: IBotServiceContainer;

    readonly #configurationService: IConfigurationService;
    readonly #featureService: IFeatureService;
    readonly #replyService: DiscordReplyService;

    constructor(services: IBotServiceContainer) {
        super(services);

        this.#services = services;

        this.#configurationService = services.configurationService;
        this.#featureService = services.featureService;
        this.#replyService = services.getReplyService();
    }

    async buildHelpArticle(interaction: Interaction): Promise<string> {
        const applicationName = this.#configurationService.applicationName;

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

        helpArticle += this.#buildLongTermMemorySection();

        return helpArticle;
    }

    #buildLongTermMemorySection(): string {
        if (!this.#featureService.hasFeature(SupportedFeature.LongTermMemory)) {
            return '';
        }

        return '## Long-Term Memory\n\n'
            + 'This bot can remember information from past conversations across channels using'
            + ' **long-term memory (LTM)**. When enabled, your messages are stored as vector'
            + ' embeddings and relevant context is retrieved before each response. Memory is'
            + ' server-scoped (only memories from the current server are used) but consent is'
            + ' global — opting in applies across all servers where this bot is present.\n\n'
            + 'Long-term memory is **opt-in per user**. Control it with these slash commands:\n\n'
            + '* **`/memory remember`** — Opts you in to long-term memory. The bot backfills your'
            + ' message history from all accessible text channels across all servers it is in.'
            + ' After opting in, your messages are stored passively as you continue to converse,'
            + ' even in channels where the bot does not respond. If the bot restarts, backfill'
            + ' and catch-up continue automatically on startup.\n\n'
            + '* **`/memory forget`** — Opts you out of long-term memory. All of your stored'
            + ' memories are **permanently deleted** across all servers, and your consent record'
            + ' is removed. This cannot be undone, but you can opt-in again at any time.\n\n';
    }
}
