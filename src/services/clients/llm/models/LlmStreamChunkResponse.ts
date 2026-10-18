import { LlmStreamChunkChoice } from './LlmStreamChunkChoice.js';
import { LlmWireUsage } from './LlmWireUsage.js';

export interface LlmStreamChunkResponse {
  choices?: LlmStreamChunkChoice[];
  usage?: LlmWireUsage;
}