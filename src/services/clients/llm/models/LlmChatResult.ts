import { LlmMessage } from './LlmMessage.js';

export interface LlmChatResult {
  message: LlmMessage;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}