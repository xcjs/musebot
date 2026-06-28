import { Attachment, BaseGuildTextChannel, ButtonInteraction, Message as DiscordMessage, MessageReaction, ThreadChannel } from 'discord.js';

import { LlmChatMessage } from '../../../llm/ollama/models/LlmChatMessage.js';
import { ILlmChatMessageFactory } from '../../../llm/services/ILlmChatMessageFactory.js';
import { IReplyService } from '../../IReplyService.js';

type DiscordReplyService = IReplyService<DiscordMessage, MessageReaction, Attachment, DiscordMessage | ButtonInteraction>;

export class DiscordLlmChatMessageFactory implements ILlmChatMessageFactory<DiscordMessage> {
    readonly #replyService: DiscordReplyService;

    constructor(services: { getReplyService(): DiscordReplyService }) {
        this.#replyService = services.getReplyService();
    }

    create(chatMessage: DiscordMessage): LlmChatMessage {
        const channelName = chatMessage.channel instanceof BaseGuildTextChannel
            ? chatMessage.channel.name
            : null;
        const channelTopic = chatMessage.channel instanceof BaseGuildTextChannel
            ? chatMessage.channel.topic
            : null;

        const thread = chatMessage.channel instanceof ThreadChannel
            ? {
                id: chatMessage.channel.id,
                name: chatMessage.channel.name,
                parentId: chatMessage.channel.parentId
            }
            : null;

        return {
            messageId: chatMessage.id,
            username: chatMessage.author.username,
            displayName: chatMessage.author.displayName,
            userId: chatMessage.author.id,
            isBot: chatMessage.author.bot,
            message: this.#replyService.getMessageWithoutBotMentions(chatMessage),
            datetime: chatMessage.createdAt.toISOString(),
            roles: chatMessage.member?.roles.cache.map((role) => ({ id: role.id, name: role.name })) ?? [],
            channel: {
                id: chatMessage.channelId,
                name: channelName,
                topic: channelTopic
            },
            thread,
            server: {
                id: chatMessage.guildId,
                name: chatMessage.guild?.name ?? null
            },
            mentions: {
                users: chatMessage.mentions.users.map((user) => ({
                    id: user.id,
                    username: user.username,
                    displayName: user.displayName,
                    isBot: user.bot
                })),
                roles: chatMessage.mentions.roles.map((role) => ({ id: role.id, name: role.name })),
                everyone: chatMessage.mentions.everyone
            }
        };
    }

    createFromLlmResponse(content: string, chatMessage: DiscordMessage): LlmChatMessage {
        const channelName = chatMessage.channel instanceof BaseGuildTextChannel
            ? chatMessage.channel.name
            : null;
        const channelTopic = chatMessage.channel instanceof BaseGuildTextChannel
            ? chatMessage.channel.topic
            : null;

        const thread = chatMessage.channel instanceof ThreadChannel
            ? {
                id: chatMessage.channel.id,
                name: chatMessage.channel.name,
                parentId: chatMessage.channel.parentId
            }
            : null;

        const clientUser = chatMessage.client.user;

        return {
            messageId: null,
            username: clientUser?.username ?? 'musebot',
            displayName: clientUser?.displayName ?? 'Musebot',
            userId: clientUser?.id ?? '0',
            isBot: true,
            message: content,
            datetime: new Date().toISOString(),
            roles: [],
            channel: {
                id: chatMessage.channelId,
                name: channelName,
                topic: channelTopic
            },
            thread,
            server: {
                id: chatMessage.guildId,
                name: chatMessage.guild?.name ?? null
            },
            mentions: {
                users: [],
                roles: [],
                everyone: false
            }
        };
    }
}