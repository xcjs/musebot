import { LlmChatMessage } from '../models/LlmChatMessage.js';
import { LlmMessage } from '../models/LlmMessage.js';

export interface IMemoryService {
  isEnabled: boolean;
  hasConsent(userId: string): Promise<boolean>;
  setConsent(userId: string): Promise<void>;
  removeConsent(userId: string): Promise<void>;
  isBackfillComplete(userId: string): Promise<boolean>;
  markBackfillComplete(userId: string): Promise<void>;
  getIncompleteBackfillUserIds(): Promise<string[]>;
  getAllConsentingUserIds(): Promise<string[]>;
  getLatestMemoryTimestamp(userId: string): Promise<string | null>;
  hasMessage(discordMessageId: string): Promise<boolean>;
  store(llmChatMessage: LlmChatMessage, ownerUserId?: string): Promise<void>;
  retrieve(llmChatMessage: LlmChatMessage): Promise<LlmMessage[]>;
  closeDatabase(): Promise<void>;
}