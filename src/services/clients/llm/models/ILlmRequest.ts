import { ILlmResponseFormat } from './ILlmResponseFormat.js';
import { ILlmStreamOptions } from './ILlmStreamOptions.js';
import { LlmMessage } from './LlmMessage.js';

export interface ILlmRequest {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  response_format?: ILlmResponseFormat;
  stream?: boolean;
  stream_options?: ILlmStreamOptions;
}