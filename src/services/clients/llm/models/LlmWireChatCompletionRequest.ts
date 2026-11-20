import { ILlmResponseFormat } from './ILlmResponseFormat.js';
import { ILlmStreamOptions } from './ILlmStreamOptions.js';
import { LlmWireMessage } from './LlmWireMessage.js';

export interface LlmWireChatCompletionRequest {
  model: string;
  messages: LlmWireMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: ILlmResponseFormat;
  stream?: boolean;
  stream_options?: ILlmStreamOptions;
}