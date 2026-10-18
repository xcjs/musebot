import { LlmImageContentPart } from './LlmImageContentPart.js';
import { LlmTextContentPart } from './LlmTextContentPart.js';

export interface LlmWireMessage {
  role: string;
  content: string | Array<LlmTextContentPart | LlmImageContentPart>;
}