import { ContextMessage } from '../ollama/models/ContextMessage.js';

export interface IContextService<ChatMessageType, LlmMessageType> {
    addContext(context: ContextMessage<ChatMessageType, LlmMessageType>[]): void;
    getContextByServerId(serverId: string): ContextMessage<ChatMessageType, LlmMessageType>[];
    getContextByChannelId(channelId: string): ContextMessage<ChatMessageType, LlmMessageType>[];
    getContextByUserId(userId: string): ContextMessage<ChatMessageType, LlmMessageType>[];
    getBaseLlmContext(): LlmMessageType[];
    clearContext(): void;
}
