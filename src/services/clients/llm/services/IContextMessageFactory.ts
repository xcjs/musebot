import { ContextMessage } from '../ollama/models/ContextMessage.js';

export interface IContextMessageFactory<ChatMessageType, LlmMessageType> {
    fromSystemContext(context: string): ContextMessage<ChatMessageType, LlmMessageType>;
    fromDiscordMessage(chatMessage: ChatMessageType): ContextMessage<ChatMessageType, LlmMessageType>;
}
