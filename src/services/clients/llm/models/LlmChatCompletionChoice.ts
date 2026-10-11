import { LlmChatCompletionMessage } from './LlmChatCompletionMessage.js';

export interface LlmChatCompletionChoice {
  message?: LlmChatCompletionMessage;
}