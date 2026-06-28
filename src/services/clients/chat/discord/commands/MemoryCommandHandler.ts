import { ChatInputCommandInteraction, Client as DiscordClient, GuildTextBasedChannel, Message as DiscordMessage } from 'discord.js';

import { IConfigurationService } from '../../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ILogger } from '../../../../ILogger.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ILlmChatMessageFactory } from '../../../llm/services/ILlmChatMessageFactory.js';
import { IMemoryService } from '../../../llm/services/IMemoryService.js';
import { DiscordAttachmentService } from '../services/DiscordAttachmentService.js';

const FETCH_PAGE_SIZE = 100;

export class MemoryCommandHandler {
    readonly #services: IBotServiceContainer;
    readonly #memoryService: IMemoryService;
    readonly #llmChatMessageFactory: ILlmChatMessageFactory<DiscordMessage>;
    readonly #featureService: IFeatureService;
    readonly #configurationService: IConfigurationService;
    readonly #taskQueue: ITaskQueue;
    readonly #logger: ILogger;
    readonly #attachmentService: DiscordAttachmentService;

    constructor(services: IBotServiceContainer) {
        this.#services = services;
        this.#memoryService = services.getMemoryService();
        this.#llmChatMessageFactory = services.getLlmChatMessageFactory<DiscordMessage>();
        this.#featureService = services.featureService;
        this.#configurationService = services.configurationService;
        this.#taskQueue = services.taskQueue;
        this.#logger = services.getLogger('MemoryCommandHandler');
        this.#attachmentService = new DiscordAttachmentService();
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

        if (alreadyConsented) {
            const backfillComplete = await this.#memoryService.isBackfillComplete(userId);

            if (backfillComplete) {
                await interaction.editReply('You are already opted in to long-term memory. Your messages will continue to be remembered.');
                return;
            }

            await interaction.editReply('You are already opted in to long-term memory. Resuming backfill of messages from all channels...');
            const backfillCount = await this.#backfillMessages(interaction.client, userId);
            await this.#memoryService.markBackfillComplete(userId);
            await interaction.editReply(
                `Backfill resumed and completed. Stored ${backfillCount} additional message${backfillCount === 1 ? '' : 's'} from all accessible channels.`);
            return;
        }

        await this.#memoryService.setConsent(userId);

        await interaction.editReply('You have opted in to long-term memory. Backfilling messages from all channels...');

        const backfillCount = await this.#backfillMessages(interaction.client, userId);

        await this.#memoryService.markBackfillComplete(userId);

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

    async resumeBackfills(client: DiscordClient): Promise<void> {
        if (!this.#featureService.hasFeature(SupportedFeature.LongTermMemory)) {
            return;
        }

        const incompleteUserIds = await this.#memoryService.getIncompleteBackfillUserIds();

        if (incompleteUserIds.length > 0) {
            this.#logger.info(`Found ${incompleteUserIds.length} user(s) with incomplete backfills. Resuming...`);

            for (const userId of incompleteUserIds) {
                try {
                    const count = await this.#backfillMessages(client, userId);
                    await this.#memoryService.markBackfillComplete(userId);
                    this.#logger.info(`Resumed backfill complete for user ${userId}. Stored ${count} messages.`);
                } catch (error) {
                    this.#logger.error(`Failed to resume backfill for user ${userId}:`, error);
                }
            }
        }

        await this.#catchUpCompletedUsers(client);
    }

    async #catchUpCompletedUsers(client: DiscordClient): Promise<void> {
        if (client.user === null) {
            return;
        }

        const botId = client.user.id;
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

        const userIds = await this.#memoryService.getAllConsentingUserIds();

        if (userIds.length === 0) {
            return;
        }

        for (const userId of userIds) {
            const latestTimestamp = await this.#memoryService.getLatestMemoryTimestamp(userId);

            if (latestTimestamp === null) {
                continue;
            }

            const afterDate = new Date(latestTimestamp);

            for (const channel of channels) {
                try {
                    const count = await this.#catchUpChannel(channel, userId, botId, afterDate);

                    if (count > 0) {
                        this.#logger.info(`Caught up ${count} new messages from #${channel.name ?? channel.id} for user ${userId}.`);
                    }
                } catch (error) {
                    this.#logger.error(`Failed to catch up channel ${channel.id} for user ${userId}:`, error);
                }
            }
        }
    }

    async #catchUpChannel(channel: GuildTextBasedChannel, userId: string, botId: string, afterDate: Date): Promise<number> {
        let count = 0;
        let afterId: string | undefined;

        for (;;) {
            const messages = await channel.messages.fetch({ limit: FETCH_PAGE_SIZE, after: afterId });

            if (messages.size === 0) {
                break;
            }

            const sortedMessages = [...messages.values()]
                .filter(m => m.createdTimestamp > afterDate.getTime())
                .sort((a: DiscordMessage, b: DiscordMessage) => a.createdTimestamp - b.createdTimestamp);

            if (sortedMessages.length === 0) {
                break;
            }

            for (const message of sortedMessages) {
                if (message.author.id !== userId && message.author.id !== botId) {
                    continue;
                }

                if (message.author.bot && message.author.id !== botId) {
                    continue;
                }

                if (!this.#isStorable(message)) {
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

            if (lastMessage === undefined || messages.size < FETCH_PAGE_SIZE) {
                break;
            }

            afterId = lastMessage.id;
        }

        return count;
    }

    async #backfillMessages(client: DiscordClient, userId: string): Promise<number> {
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
            const messages = await channel.messages.fetch({ limit: FETCH_PAGE_SIZE, before: beforeId });

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

                if (!this.#isStorable(message)) {
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

            if (messages.size < FETCH_PAGE_SIZE) {
                break;
            }
        }

        return count;
    }

    #isStorable(message: DiscordMessage): boolean {
        const hasText = message.content.trim().length > 0;
        const hasImages = this.#featureService.hasFeature(SupportedFeature.Vision)
            && this.#attachmentService.getImageAttachments(message).length > 0;

        return hasText || hasImages;
    }
}