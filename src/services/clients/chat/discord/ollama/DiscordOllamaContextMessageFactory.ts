import { Attachment, ButtonInteraction, Message, MessageReaction } from 'discord.js';
import { Message as DiscordMessage } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { IServiceContainer } from '../../../../IServiceContainer.js';
import { OllamaRole } from '../../../llm/ollama/enums/OllamaRole.js';
import { ContextMessage } from '../../../llm/ollama/models/ContextMessage.js';
import { IContextMessageFactory } from '../../../llm/services/IContextMessageFactory.js';
import { IReplyService } from '../../IReplyService.js';

type DiscordReplyService = IReplyService<DiscordMessage, MessageReaction, Attachment, DiscordMessage | ButtonInteraction>;

export class DiscordOllamaContextMessageFactory implements IContextMessageFactory<DiscordMessage, OllamaMessage> {
    #replyService: DiscordReplyService;

    constructor(services: IServiceContainer) {
        this.#replyService = services.getReplyService();
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
