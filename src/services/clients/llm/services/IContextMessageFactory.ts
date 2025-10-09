import { ContextMessage } from '../ollama/models/ContextMessage.js';

export interface IContextMessageFactory<ChatMessageType, LlmMessageType> {
    fromSystemPrompt(prompt: string): ContextMessage<ChatMessageType, LlmMessageType>;
    fromMessagePair(chatMessage: ChatMessageType, llmMesage: LlmMessageType): ContextMessage<ChatMessageType, LlmMessageType>;
    fromChatMessage(chatMessage: ChatMessageType): ContextMessage<ChatMessageType, LlmMessageType>;
    fromChatPrompt(prompt: string, userId: string): ContextMessage<ChatMessageType, LlmMessageType>;
    fromLlmResponse(llmMessage: LlmMessageType, userId: string | null, channelId: string | null, serverId: string | null)
        : ContextMessage<ChatMessageType, LlmMessageType>
}
