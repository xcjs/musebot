import { ChatInputCommandInteraction, GuildTextBasedChannel, Message as DiscordMessage } from 'discord.js';

import { IConfigurationService } from '../../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ILogger } from '../../../../ILogger.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ILlmChatMessageFactory } from '../../../llm/services/ILlmChatMessageFactory.js';
import { IMemoryService } from '../../../llm/services/IMemoryService.js';

const FETCH_LIMIT = 100;

export class MemoryCommandHandler {
    readonly #services: IBotServiceContainer;
    readonly #memoryService: IMemoryService;
    readonly #llmChatMessageFactory: ILlmChatMessageFactory<DiscordMessage>;
    readonly #featureService: IFeatureService;
    readonly #configurationService: IConfigurationService;
    readonly #taskQueue: ITaskQueue;
    readonly #logger: ILogger;

    constructor(services: IBotServiceContainer) {
        this.#services = services;
        this.#memoryService = services.getMemoryService();
        this.#llmChatMessageFactory = services.getLlmChatMessageFactory<DiscordMessage>();
        this.#featureService = services.featureService;
        this.#configurationService = services.configurationService;
        this.#taskQueue = services.taskQueue;
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

        await interaction.editReply('You have opted in to long-term memory. Backfilling messages from all channels...');

        const backfillCount = await this.#backfillMessages(interaction);

        await interaction.editReply(
            `You have opted in to long-term memory. Backfilled ${backfillCount} message${backfillCount === 1 ? '' : 's'} from all accessible channels.`);
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
        const userId = interaction.user.id;
        const client = interaction.client;
        const botId = client.user?.id;

        if (botId === undefined) {
            return 0;
        }

        const disallowedChannelIds = this.#configurationService.discordChannelsDisallowed;
        const channels: GuildTextBasedChannel[] = [];

        for (const guild of client.guilds.cache.values()) {
            for (const channel of guild.channels.cache.values()) {
                if (!channel.isTextBased() || channel.isVoiceBased()) {
                    continue;
                }

                if (disallowedChannelIds.includes(channel.id)) {
                    continue;
                }

                if (!(channel as GuildTextBasedChannel).viewable) {
                    continue;
                }

                channels.push(channel as GuildTextBasedChannel);
            }
        }

        let totalCount = 0;

        for (const channel of channels) {
            try {
                const count = await this.#backfillChannel(channel, userId, botId);

                if (count > 0) {
                    this.#logger.info(`Backfilled ${count} messages from #${channel.name ?? channel.id}.`);
                }

                totalCount += count;
            } catch (error) {
                this.#logger.error(`Failed to backfill channel ${channel.id}:`, error);
            }
        }

        this.#logger.info(`Backfilled ${totalCount} total messages for user ${userId}.`);
        return totalCount;
    }

    async #backfillChannel(channel: GuildTextBasedChannel, userId: string, botId: string): Promise<number> {
        let count = 0;
        let beforeId: string | undefined;

        for (;;) {
            const messages = await channel.messages.fetch({ limit: FETCH_LIMIT, before: beforeId });

            if (messages.size === 0) {
                break;
            }

            const sortedMessages = [...messages.values()].sort(
                (a: DiscordMessage, b: DiscordMessage) => a.createdTimestamp - b.createdTimestamp);

            for (const message of sortedMessages) {
                if (message.author.id !== userId && message.author.id !== botId) {
                    continue;
                }

                if (message.author.bot && message.author.id !== botId) {
                    continue;
                }

                if (message.content.trim().length === 0) {
                    continue;
                }

                const llmChatMessage = this.#llmChatMessageFactory.create(message);
                const ownerUserId = message.author.id === botId ? userId : undefined;
                const task = this.#services.getEmbedTask(llmChatMessage, ownerUserId);

                const promise = new Promise<boolean>((resolve) => {
                    task.onSuccess = (): void => resolve(true);
                    task.onFailure = (): void => resolve(false);
                });

                this.#taskQueue.add(task as BaseTask<unknown>);

                const [success] = await Promise.all([promise]);
                if (success) {
                    count++;
                }
            }

            const lastMessage = sortedMessages[sortedMessages.length - 1];

            if (lastMessage === undefined) {
                break;
            }

            beforeId = lastMessage.id;

            if (messages.size < FETCH_LIMIT) {
                break;
            }
        }

        return count;
    }
}