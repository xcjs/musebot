import { Message as DiscordMessage } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { IServiceContainer } from '../../../../IServiceContainer.js';
import { OllamaRole } from '../../../llm/ollama/enums/OllamaRole.js';
import { ContextMessage } from '../../../llm/ollama/models/ContextMessage.js';
import { IContextMessageFactory } from '../../../llm/services/IContextMessageFactory.js';
import { IReplyService } from '../../IReplyService.js';

export class DiscordOllamaContextMessageFactory implements IContextMessageFactory<DiscordMessage, OllamaMessage> {
    #replyService: IReplyService;

    constructor(services: IServiceContainer) {
        this.#replyService = services.replyService;
    }

    fromSystemPrompt(prompt: string): ContextMessage<DiscordMessage, OllamaMessage> {
        const ollamaMessage: OllamaMessage = {
            role: OllamaRole.System,
            content: prompt
        };

        return {
            messageId: null,
            channelId: null,
            serverId: null,
            userId: null,
            chatMessage: null,
            timestamp: new Date(),
            llmMessage: ollamaMessage,
            isReadOnly: true
        };
    }

    fromMessagePair(chatMessage: DiscordMessage, llmMessage: OllamaMessage): ContextMessage<DiscordMessage, OllamaMessage> {
        return {
            messageId: null,
            channelId: chatMessage.channelId,
            serverId: chatMessage.guildId,
            userId: null,
            timestamp: new Date(),
            chatMessage,
            llmMessage,
            isReadOnly: false
        };
    }

    fromChatMessage(chatMessage: DiscordMessage): ContextMessage<DiscordMessage, OllamaMessage> {
        const ollamaMessage: OllamaMessage = {
            role: OllamaRole.User,
            content: `${chatMessage.author.displayName}: ${this.#replyService.getMessageWithoutBotMentions(chatMessage)}`
        }

        return {
            messageId: chatMessage.id,
            channelId: chatMessage.channelId,
            serverId: chatMessage.guildId,
            userId: chatMessage.author.id,
            timestamp: new Date(),
            chatMessage,
            llmMessage: ollamaMessage,
            isReadOnly: false,
        } as ContextMessage<DiscordMessage, OllamaMessage>;
    }

    fromChatPrompt(prompt: string, userId: string): ContextMessage<DiscordMessage, OllamaMessage> {
        const ollamaMessage: OllamaMessage = {
            role: OllamaRole.Assistant,
            content: prompt
        };

        return {
            messageId: null,
            channelId: null,
            serverId: null,
            userId,
            chatMessage: null,
            timestamp: new Date(),
            llmMessage: ollamaMessage,
            isReadOnly: false
        };
    }

    fromLlmResponse(llmMessage: OllamaMessage, userId: string | null, channelId: string | null, serverId: string | null)
        : ContextMessage<DiscordMessage, OllamaMessage> {
        return {
            messageId: null,
            channelId,
            serverId,
            userId,
            chatMessage: null,
            timestamp: new Date(),
            llmMessage,
            isReadOnly: false
        };
    }
}
