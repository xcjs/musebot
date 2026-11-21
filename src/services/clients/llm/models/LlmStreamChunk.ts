export interface LlmStreamChunk {
  content: string;
  done: boolean;
  reasoning?: string;
  promptTokens?: number;
  completionTokens?: number;
}