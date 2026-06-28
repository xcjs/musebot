import { Message as OllamaMessage } from 'ollama';

import { LlmChatMessage } from '../ollama/models/LlmChatMessage.js';

export interface IMemoryService {
    isEnabled: boolean;
    hasConsent(userId: string): Promise<boolean>;
    setConsent(userId: string): Promise<void>;
    removeConsent(userId: string): Promise<void>;
    store(llmChatMessage: LlmChatMessage, ownerUserId?: string): Promise<void>;
    retrieve(llmChatMessage: LlmChatMessage): Promise<OllamaMessage[]>;
}