import { ChatInputCommandInteraction, DMChannel, Message as DiscordMessage, TextChannel } from 'discord.js';

import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ILogger } from '../../../../ILogger.js';
import { ILlmChatMessageFactory } from '../../../llm/services/ILlmChatMessageFactory.js';
import { IMemoryService } from '../../../llm/services/IMemoryService.js';

const BACKFILL_LIMIT = 100;

export class MemoryCommandHandler {
    readonly #services: IBotServiceContainer;
    readonly #memoryService: IMemoryService;
    readonly #llmChatMessageFactory: ILlmChatMessageFactory<DiscordMessage>;
    readonly #featureService: IFeatureService;
    readonly #logger: ILogger;

    constructor(services: IBotServiceContainer) {
        this.#services = services;
        this.#memoryService = services.getMemoryService();
        this.#llmChatMessageFactory = services.getLlmChatMessageFactory<DiscordMessage>();
        this.#featureService = services.featureService;
        this.#logger = services.getLogger('MemoryCommandHandler');
    }

    async handle(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.#featureService.hasFeature(SupportedFeature.LongTermMemory)) {
            await interaction.editReply('Long-term memory is not enabled on this bot.');
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'remember':
                await this.#handleRemember(interaction);
                break;
            case 'forget':
                await this.#handleForget(interaction);
                break;
            default:
                await interaction.editReply('Unknown memory command.');
                break;
        }
    }

    async #handleRemember(interaction: ChatInputCommandInteraction): Promise<void> {
        const userId = interaction.user.id;

        const alreadyConsented = await this.#memoryService.hasConsent(userId);

        await this.#memoryService.setConsent(userId);

        if (alreadyConsented) {
            await interaction.editReply('You are already opted in to long-term memory. Your messages will continue to be remembered.');
            return;
        }

        await interaction.editReply('You have opted in to long-term memory. Backfilling recent messages from this channel...');

        const backfillCount = await this.#backfillMessages(interaction);

        await interaction.editReply(
            `You have opted in to long-term memory. Backfilled ${backfillCount} recent message${backfillCount === 1 ? '' : 's'} from this channel.`);
    }

    async #handleForget(interaction: ChatInputCommandInteraction): Promise<void> {
        const userId = interaction.user.id;

        const hadConsent = await this.#memoryService.hasConsent(userId);

        await this.#memoryService.removeConsent(userId);

        if (!hadConsent) {
            await interaction.editReply('You were not opted in to long-term memory. Nothing to forget.');
            return;
        }

        await interaction.editReply('You have opted out of long-term memory. All your stored memories have been deleted.');
    }

    async #backfillMessages(interaction: ChatInputCommandInteraction): Promise<number> {
        const channel = interaction.channel;

        if (channel === null) {
            return 0;
        }

        if (!(channel instanceof TextChannel) && !(channel instanceof DMChannel)) {
            this.#logger.info('Backfill skipped — channel is not a text or DM channel.');
            return 0;
        }

        try {
            const messages = await channel.messages.fetch({ limit: BACKFILL_LIMIT });
            const sortedMessages = [...messages.values()].sort(
                (a: DiscordMessage, b: DiscordMessage) => a.createdTimestamp - b.createdTimestamp);

            let count = 0;

            for (const message of sortedMessages) {
                if (message.author.bot && message.author.id !== interaction.client.user?.id) {
                    continue;
                }

                if (message.content.trim().length === 0) {
                    continue;
                }

                const llmChatMessage = this.#llmChatMessageFactory.create(message);
                await this.#memoryService.store(llmChatMessage);
                count++;
            }

            this.#logger.info(`Backfilled ${count} messages for user ${interaction.user.id}.`);
            return count;
        } catch (error) {
            this.#logger.error('Failed to backfill messages:', error);
            return 0;
        }
    }
}