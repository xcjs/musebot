import { LlamaCppModelStatus } from './LlamaCppModelStatus.js';

export interface LlamaCppModelsResponse {
  models?: Array<{ model?: string; status?: LlamaCppModelStatus }>;
  data?: Array<{ id?: string; status?: LlamaCppModelStatus }>;
}