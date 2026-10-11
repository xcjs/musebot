import { LlmStreamDelta } from './LlmStreamDelta.js';

export interface LlmStreamChunkChoice {
  delta?: LlmStreamDelta;
}