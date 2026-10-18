import { ILlmResponseFormat } from './ILlmResponseFormat.js';
import { ILlmStreamOptions } from './ILlmStreamOptions.js';
import { LlmWireMessage } from './LlmWireMessage.js';

export interface LlmWireChatCompletionRequest {
  model: string;
  messages: LlmWireMessage[];
  temperature?: number;
  response_format?: ILlmResponseFormat;
  stream?: boolean;
  stream_options?: ILlmStreamOptions;
}