import { IHttpExchange } from '../../../models/IHttpExchange.js';
import { IHttpExchangeWithAttachedData } from '../../../models/IHttpExchangeWithAttachedData.js';
import { ILlmRequest } from './models/ILlmRequest.js';
import { IStructuredRequestData } from './models/IStructuredRequestData.js';
import { LlmChatResult } from './models/LlmChatResult.js';
import { LlmGenerateResult } from './models/LlmGenerateResult.js';
import { LlmMessage } from './models/LlmMessage.js';
import { LlmShowResponse } from './models/LlmShowResponse.js';
import { LlmStreamChunk } from './models/LlmStreamChunk.js';

export interface ILlmClient {
  readonly host: URL;
  readonly model: string;
  generate(prompt: string, temperature?: number): Promise<IHttpExchange<ILlmRequest, LlmGenerateResult>>;
  generateStructured<TOutput>(prompt: string, requestData: IStructuredRequestData): Promise<IHttpExchangeWithAttachedData<ILlmRequest, LlmGenerateResult, TOutput>>;
  sendMessage(prompt: string, context: LlmMessage[], images?: string[]): Promise<IHttpExchangeWithAttachedData<ILlmRequest, LlmChatResult, LlmMessage[]>>;
  sendMessageAndGetStream(prompt: string, context: LlmMessage[], images?: string[]): Promise<IHttpExchangeWithAttachedData<ILlmRequest, AsyncIterable<LlmStreamChunk>, LlmMessage[]> | null>;
  embed(input: string): Promise<number[]>;
  embedBatch(inputs: string[]): Promise<number[][]>;
  interpretImages(images: string[], contextPrompt?: string): Promise<string>;
  free(): Promise<boolean>;
  isModelLoaded(): Promise<boolean>;
  waitForModelUnload(intervalMs?: number): Promise<boolean>;
  getContextWindow(): Promise<number | null>;
  hasVisionCapability(model?: string): Promise<boolean>;
  show(model?: string): Promise<LlmShowResponse>;
}