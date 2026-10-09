export interface LlmGenerateResult {
  content: string;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  tokensPerSecond?: number;
}