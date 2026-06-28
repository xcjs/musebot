import { Attachment, BaseGuildTextChannel, ButtonInteraction, Message as DiscordMessage, MessageReaction, ThreadChannel } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { OllamaRole } from '../../../llm/ollama/enums/OllamaRole.js';
import { ContextMessage } from '../../../llm/ollama/models/ContextMessage.js';
import { LlmChatMessage } from '../../../llm/ollama/models/LlmChatMessage.js';
import { IContextMessageFactory } from '../../../llm/services/IContextMessageFactory.js';
import { IReplyService } from '../../IReplyService.js';

type DiscordReplyService = IReplyService<DiscordMessage, MessageReaction, Attachment, DiscordMessage | ButtonInteraction>;

export class DiscordOllamaContextMessageFactory implements IContextMessageFactory<DiscordMessage, OllamaMessage> {
    #replyService: DiscordReplyService;

    constructor(services: IBotServiceContainer) {
        this.#replyService = services.getReplyService();
    }

    formatChatMessage(chatMessage: DiscordMessage): string {
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

        const llmChatMessage: LlmChatMessage = {
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

        return JSON.stringify(llmChatMessage);
    }

    fromSystemPrompt(prompt: string, channelId: string | null, isReadOnly = true): ContextMessage<DiscordMessage, OllamaMessage> {
        const ollamaMessage: OllamaMessage = {
            role: OllamaRole.System,
            content: prompt
        };

        return {
            messageId: null,
            associatedMessageId: null,
            userId: null,
            associatedUserId: null,
            channelId: channelId,
            serverId: null,
            chatMessage: null,
            timestamp: new Date(),
            llmMessage: ollamaMessage,
            isReadOnly: isReadOnly,
            isPrivate: false
        };
    }

    fromChatMessage(chatMessage: DiscordMessage): ContextMessage<DiscordMessage, OllamaMessage> {
        const ollamaMessage: OllamaMessage = {
            role: OllamaRole.User,
            content: this.formatChatMessage(chatMessage)
        }

        return {
            messageId: chatMessage.id,
            channelId: chatMessage.channelId,
            serverId: chatMessage.guildId,
            userId: chatMessage.author.id,
            timestamp: chatMessage.createdAt,
            chatMessage,
            llmMessage: ollamaMessage,
            isReadOnly: false,
            isPrivate: chatMessage.guildId === null
        } as ContextMessage<DiscordMessage, OllamaMessage>;
    }

    fromChatPrompt(prompt: string,
        userId: string,
        serverId: string | null,
        channelId: string | null,
        associatedMessageId: string | null): ContextMessage<DiscordMessage, OllamaMessage> {
        const ollamaMessage: OllamaMessage = {
            role: OllamaRole.Assistant,
            content: prompt
        };

        return {
            messageId: null,
            associatedMessageId,
            userId,
            associatedUserId: null,
            channelId,
            serverId,
            timestamp: new Date(),
            chatMessage: null,
            llmMessage: ollamaMessage,
            isReadOnly: false,
            isPrivate: serverId === null
        };
    }

    fromLlmMessage(llmMessage: OllamaMessage,
        associatedUserId: string | null,
        serverId: string | null,
        channelId: string | null,
        associatedMessageId: string | null): ContextMessage<DiscordMessage, OllamaMessage> {
        return {
            messageId: null,
            associatedMessageId,
            userId: null,
            associatedUserId,
            channelId,
            serverId,
            timestamp: new Date(),
            chatMessage: null,
            llmMessage,
            isReadOnly: false,
            isPrivate: serverId === null
        };
    }
}
