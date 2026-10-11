import { LlmChatMessage } from '../llm/models/LlmChatMessage.js';
import { LlmMessage } from '../llm/models/LlmMessage.js';

export interface IInputChatMessageFilter<ChatMessageType> {
  process(llmChatMessage: LlmChatMessage, chatMessage: ChatMessageType, context: LlmMessage[]): Promise<LlmMessage[]>;
}