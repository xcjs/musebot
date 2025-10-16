import { ContextMessage } from '../ollama/models/ContextMessage.js';

export interface IContextMessageFactory<ChatMessageType, LlmMessageType> {
    fromSystemPrompt(
        prompt: string,
        chanelId: string | null,
        isReadOnly: boolean): ContextMessage<ChatMessageType, LlmMessageType>;

    fromChatMessage(chatMessage: ChatMessageType): ContextMessage<ChatMessageType, LlmMessageType>;

    fromChatPrompt(
        prompt: string,
        userId: string,
        serverId: string | null,
        channelId: string | null,
        associatedMessageId: string | null): ContextMessage<ChatMessageType, LlmMessageType>;

    fromLlmMessage(
        llmMessage: LlmMessageType,
        associatedUserId: string | null,
        serverId: string | null,
        channelId: string | null,
        associatedMessageId: string | null): ContextMessage<ChatMessageType, LlmMessageType>;
}
