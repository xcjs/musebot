import { LlmRole } from '../enums/LlmRole.js';

export interface LlmMessage {
  role: LlmRole;
  content: string;
  images?: string[];
}