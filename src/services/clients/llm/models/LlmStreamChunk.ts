export interface LlmStreamChunk {
  content: string;
  done: boolean;
  promptTokens?: number;
  completionTokens?: number;
}