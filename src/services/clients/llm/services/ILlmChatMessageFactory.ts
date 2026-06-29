import { LlmChatMessage } from '../ollama/models/LlmChatMessage.js';

export interface ILlmChatMessageFactory<ChatMessageType> {
    create(chatMessage: ChatMessageType): LlmChatMessage;

    createFromLlmResponse(content: string, chatMessage: ChatMessageType): LlmChatMessage;
}