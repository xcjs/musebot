import { LlmModality } from '../clients/llm/enums/LlmModality.js';

export interface ILlmModelConfig {
  name: string;
  inputModalities?: LlmModality[];
  outputModalities?: LlmModality[];
}