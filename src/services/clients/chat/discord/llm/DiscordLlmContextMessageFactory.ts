import { Message as DiscordMessage } from 'discord.js';

import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { LlmRole } from '../../../llm/enums/LlmRole.js';
import { ContextMessage } from '../../../llm/models/ContextMessage.js';
import { LlmMessage } from '../../../llm/models/LlmMessage.js';
import { IContextMessageFactory } from '../../../llm/services/IContextMessageFactory.js';
import { ILlmChatMessageFactory } from '../../../llm/services/ILlmChatMessageFactory.js';

export class DiscordLlmContextMessageFactory implements IContextMessageFactory<DiscordMessage, LlmMessage> {
  #llmChatMessageFactory: ILlmChatMessageFactory<DiscordMessage>;

  constructor(services: IBotServiceContainer) {
    this.#llmChatMessageFactory = services.getLlmChatMessageFactory();
  }

  formatChatMessage(chatMessage: DiscordMessage): string {
    return JSON.stringify(this.#llmChatMessageFactory.create(chatMessage));
  }

  fromSystemPrompt(prompt: string, channelId: string | null, isReadOnly = true): ContextMessage<DiscordMessage, LlmMessage> {
    const llmMessage: LlmMessage = {
      role: LlmRole.System,
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
      llmMessage: llmMessage,
      isReadOnly: isReadOnly,
      isPrivate: false,
      isSummary: false
    };
  }

  fromChatMessage(chatMessage: DiscordMessage): ContextMessage<DiscordMessage, LlmMessage> {
    const llmMessage: LlmMessage = {
      role: LlmRole.User,
      content: this.formatChatMessage(chatMessage)
    }

    return {
      messageId: chatMessage.id,
      channelId: chatMessage.channelId,
      serverId: chatMessage.guildId,
      userId: chatMessage.author.id,
      timestamp: chatMessage.createdAt,
      chatMessage,
      llmMessage: llmMessage,
      isReadOnly: false,
      isPrivate: chatMessage.guildId === null,
      isSummary: false
    } as ContextMessage<DiscordMessage, LlmMessage>;
  }

  fromChatPrompt(prompt: string,
    userId: string,
    serverId: string | null,
    channelId: string | null,
    associatedMessageId: string | null): ContextMessage<DiscordMessage, LlmMessage> {
    const llmMessage: LlmMessage = {
      role: LlmRole.Assistant,
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
      llmMessage: llmMessage,
      isReadOnly: false,
      isPrivate: serverId === null,
      isSummary: false
    };
  }

  fromLlmMessage(llmMessage: LlmMessage,
    associatedUserId: string | null,
    serverId: string | null,
    channelId: string | null,
    associatedMessageId: string | null): ContextMessage<DiscordMessage, LlmMessage> {
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
      isPrivate: serverId === null,
      isSummary: false
    };
  }

  fromSummary(summary: string, channelId: string | null): ContextMessage<DiscordMessage, LlmMessage> {
    const llmMessage: LlmMessage = {
      role: LlmRole.System,
      content: summary
    };

    return {
      messageId: null,
      associatedMessageId: null,
      userId: null,
      associatedUserId: null,
      channelId: channelId,
      serverId: null,
      timestamp: new Date(),
      chatMessage: null,
      llmMessage: llmMessage,
      isReadOnly: false,
      isPrivate: false,
      isSummary: true
    };
  }
}