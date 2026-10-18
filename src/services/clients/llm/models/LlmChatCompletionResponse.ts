import { LlmChatCompletionChoice } from './LlmChatCompletionChoice.js';
import { LlmWireUsage } from './LlmWireUsage.js';

export interface LlmChatCompletionResponse {
  choices?: LlmChatCompletionChoice[];
  usage?: LlmWireUsage;
}