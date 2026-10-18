import { LlmImageUrl } from './LlmImageUrl.js';

export interface LlmImageContentPart {
  type: 'image_url';
  image_url: LlmImageUrl;
}