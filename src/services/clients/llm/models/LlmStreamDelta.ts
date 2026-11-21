export interface LlmStreamDelta {
  role?: string;
  content?: string | null;
  reasoning_content?: string | null;
  reasoning?: string | null;
}