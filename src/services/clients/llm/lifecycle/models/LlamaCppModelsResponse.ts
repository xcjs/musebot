import { LlamaCppModelStatus } from './LlamaCppModelStatus.js';

export interface LlamaCppModelsResponse {
  models?: Array<{ model?: string; status?: LlamaCppModelStatus }>;
}