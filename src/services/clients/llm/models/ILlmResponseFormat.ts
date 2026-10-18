import { ILlmJsonSchema } from './ILlmJsonSchema.js';

export interface ILlmResponseFormat {
  type: string;
  json_schema?: ILlmJsonSchema;
}