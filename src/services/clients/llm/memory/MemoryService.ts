import { Message as OllamaMessage } from 'ollama';

import { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../features/IFeatureService.js';
import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { ILogger } from '../../../ILogger.js';
import { OllamaRole } from '../ollama/enums/OllamaRole.js';
import { LlmChatMessage } from '../ollama/models/LlmChatMessage.js';
import { OllamaClient } from '../ollama/OllamaClient.js';
import { IMemoryService } from '../services/IMemoryService.js';
import { MemoryDatabase, MemoryRecord } from './MemoryDatabase.js';

const MEMORY_DATABASE_DIR = 'workflows';
const MEMORY_DATABASE_FILENAME = 'txt2txt/memory.db';

export class MemoryService implements IMemoryService {
    readonly #services: IBotServiceContainer;
    readonly #configurationService: IConfigurationService;
    readonly #featureService: IFeatureService;
    readonly #logger: ILogger;

    #database: MemoryDatabase | null = null;
    #embeddingDimensions: number | null = null;

    constructor(services: IBotServiceContainer) {
        this.#services = services;
        this.#configurationService = services.configurationService;
        this.#featureService = services.featureService;
        this.#logger = services.getLogger('MemoryService');
    }

    get isEnabled(): boolean {
        return this.#featureService.hasFeature(SupportedFeature.LongTermMemory);
    }

    async hasConsent(userId: string): Promise<boolean> {
        if (!this.isEnabled) {
            return false;
        }

        const database = await this.#getDatabase();
        return database.hasConsent(userId);
    }

    async setConsent(userId: string): Promise<void> {
        if (!this.isEnabled) {
            return;
        }

        const database = await this.#getDatabase();
        database.setConsent(userId);
        this.#logger.info(`Consent set for user ${userId}.`);
    }

    async removeConsent(userId: string): Promise<void> {
        if (!this.isEnabled) {
            return;
        }

        const database = await this.#getDatabase();
        database.removeConsent(userId);
        this.#logger.info(`Consent removed for user ${userId}. All memories deleted.`);
    }

    async store(llmChatMessage: LlmChatMessage, ownerUserId?: string): Promise<void> {
        if (!this.isEnabled) {
            return;
        }

        const consentUserId = ownerUserId ?? llmChatMessage.userId;

        if (!await this.hasConsent(consentUserId)) {
            return;
        }

        try {
            const embedding = await this.#embed(llmChatMessage.message);
            const json = JSON.stringify(llmChatMessage);
            const database = await this.#getDatabase();

            database.storeMemory(
                json,
                llmChatMessage.message,
                consentUserId,
                llmChatMessage.server.id,
                llmChatMessage.isBot,
                embedding);
        } catch (error) {
            this.#logger.error(`Failed to store memory for user ${consentUserId}:`, error);
        }
    }

    async retrieve(llmChatMessage: LlmChatMessage): Promise<OllamaMessage[]> {
        if (!this.isEnabled) {
            return [];
        }

        const serverId = llmChatMessage.server.id;

        if (serverId === null) {
            return [];
        }

        try {
            const embedding = await this.#embed(llmChatMessage.message);
            const topK = this.#configurationService.ollamaTopK;
            const database = await this.#getDatabase();
            const records = database.queryMemories(embedding, serverId, topK);

            if (records.length === 0) {
                return [];
            }

            const memoryText = records.map((record: MemoryRecord) => record.content).join('\n\n');
            const systemMessage: OllamaMessage = {
                role: OllamaRole.System,
                content: `The following are relevant memories from past conversations in this server:\n\n${memoryText}`
            };

            return [systemMessage];
        } catch (error) {
            this.#logger.error('Failed to retrieve memories:', error);
            return [];
        }
    }

    async #embed(text: string): Promise<number[]> {
        const client: OllamaClient = this.#services.ollamaClient;
        return await client.embed(text);
    }

    async #getDatabase(): Promise<MemoryDatabase> {
        if (this.#database !== null) {
            return this.#database;
        }

        const dimensions = await this.#getEmbeddingDimensions();
        const dbPath = `${MEMORY_DATABASE_DIR}/${this.#configurationService.botId}/${MEMORY_DATABASE_FILENAME}`;
        this.#database = new MemoryDatabase(dbPath, dimensions, this.#logger);
        return this.#database;
    }

    async #getEmbeddingDimensions(): Promise<number> {
        if (this.#embeddingDimensions !== null) {
            return this.#embeddingDimensions;
        }

        const embedding = await this.#embed('dimension probe');
        this.#embeddingDimensions = embedding.length;
        this.#logger.info(`Detected embedding dimensions: ${this.#embeddingDimensions}`);

        return this.#embeddingDimensions;
    }
}