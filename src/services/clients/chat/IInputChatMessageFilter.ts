import { Message as OllamaMessage } from 'ollama';

import { LlmChatMessage } from '../llm/ollama/models/LlmChatMessage.js';

export interface IInputChatMessageFilter<ChatMessageType> {
    process(llmChatMessage: LlmChatMessage, chatMessage: ChatMessageType, context: OllamaMessage[]): Promise<OllamaMessage[]>;
}