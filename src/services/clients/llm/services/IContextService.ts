import { ContextMessage } from '../ollama/models/ContextMessage.js';

export interface IContextService<ChatMessageType, LlmMessageType> {
    addContext(context: ContextMessage<ChatMessageType, LlmMessageType>[]): void;
    getContextByServerId(serverId: string): LlmMessageType[];
    getContextByChannelId(channelId: string): LlmMessageType[];
    getContextByUserId(userId: string): LlmMessageType[];
    clearContext(channelId: string): void;
}
