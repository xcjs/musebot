import { Message as DiscordMessage } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { OllamaRole } from '../../../llm/ollama/enums/OllamaRole.js';
import { ContextMessage } from '../../../llm/ollama/models/ContextMessage.js';
import { IContextMessageFactory } from '../../../llm/services/IContextMessageFactory.js';
import { ILlmChatMessageFactory } from '../../../llm/services/ILlmChatMessageFactory.js';

export class DiscordOllamaContextMessageFactory implements IContextMessageFactory<DiscordMessage, OllamaMessage> {
    #llmChatMessageFactory: ILlmChatMessageFactory<DiscordMessage>;

    constructor(services: IBotServiceContainer) {
        this.#llmChatMessageFactory = services.getLlmChatMessageFactory();
    }

    formatChatMessage(chatMessage: DiscordMessage): string {
        return JSON.stringify(this.#llmChatMessageFactory.create(chatMessage));
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
