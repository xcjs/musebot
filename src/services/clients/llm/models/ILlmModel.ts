import { LlmModality } from '../enums/LlmModality.js';

export interface ILlmModel {
  name: string;
  inputModalities: LlmModality[];
  outputModalities: LlmModality[];
  maxOutputTokens: number | null;
}