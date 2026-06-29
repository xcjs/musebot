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

    async isBackfillComplete(userId: string): Promise<boolean> {
        if (!this.isEnabled) {
            return false;
        }

        const database = await this.#getDatabase();
        return database.isBackfillComplete(userId);
    }

    async markBackfillComplete(userId: string): Promise<void> {
        if (!this.isEnabled) {
            return;
        }

        const database = await this.#getDatabase();
        database.markBackfillComplete(userId);
        this.#logger.info(`Backfill marked complete for user ${userId}.`);
    }

    async getIncompleteBackfillUserIds(): Promise<string[]> {
        if (!this.isEnabled) {
            return [];
        }

        const database = await this.#getDatabase();
        return database.getIncompleteBackfillUserIds();
    }

    async getLatestMemoryTimestamp(userId: string): Promise<string | null> {
        if (!this.isEnabled) {
            return null;
        }

        const database = await this.#getDatabase();
        return database.getLatestMemoryTimestamp(userId);
    }

    async getAllConsentingUserIds(): Promise<string[]> {
        if (!this.isEnabled) {
            return [];
        }

        const database = await this.#getDatabase();
        return database.getAllConsentingUserIds();
    }

    async hasMessage(discordMessageId: string): Promise<boolean> {
        if (!this.isEnabled || discordMessageId === null) {
            return false;
        }

        try {
            const database = await this.#getDatabase();
            return database.hasMessage(discordMessageId);
        } catch (error) {
            this.#logger.error('Failed to check existing message:', error);
            return false;
        }
    }

    async store(llmChatMessage: LlmChatMessage, ownerUserId?: string): Promise<void> {
        if (!this.isEnabled) {
            this.#logger.debug('store() skipped: memory not enabled.');
            return;
        }

        const consentUserId = ownerUserId ?? llmChatMessage.userId;

        if (!await this.hasConsent(consentUserId)) {
            this.#logger.debug(`store() skipped: no consent for user ${consentUserId} (messageId=${llmChatMessage.messageId}).`);
            return;
        }

        this.#logger.debug(`store() proceeding for user ${consentUserId} (messageId=${llmChatMessage.messageId}, isBot=${llmChatMessage.isBot}).`);

        try {
            const embedding = await this.#embed(llmChatMessage.message);
            const json = JSON.stringify(llmChatMessage);
            const database = await this.#getDatabase();
            const embeddingModel = this.#getEmbeddingModel();

            const rowId = database.storeMemory(
                json,
                llmChatMessage.message,
                consentUserId,
                llmChatMessage.server.id,
                llmChatMessage.isBot,
                embeddingModel,
                llmChatMessage.messageId,
                embedding);

            if (rowId === null) {
                this.#logger.debug(`store() deduped: messageId=${llmChatMessage.messageId} already exists.`);
            } else {
                this.#logger.debug(`store() inserted: messageId=${llmChatMessage.messageId} rowId=${rowId}.`);
            }
        } catch (error) {
            this.#logger.error(`Failed to store memory for user ${consentUserId} (messageId=${llmChatMessage.messageId}):`, error);
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
            const embeddingModel = this.#getEmbeddingModel();
            const database = await this.#getDatabase();
            const records = database.queryMemories(embedding, serverId, embeddingModel, topK);

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

    #getEmbeddingModel(): string {
        const model = this.#configurationService.ollamaEmbeddingModel;
        if (model === null) {
            throw new Error('Embedding model is not configured but LTM is enabled.');
        }
        return model;
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

        await this.#migrateEmbeddingModel(this.#database);

        return this.#database;
    }

    async #migrateEmbeddingModel(database: MemoryDatabase): Promise<void> {
        const currentModel = this.#getEmbeddingModel();

        const currentModelCount = database.getMemoryCountByModel(currentModel);
        const totalCount = database.getTotalMemoryCount();

        if (totalCount === 0 || currentModelCount === totalCount) {
            return;
        }

        this.#logger.info(`Migrating memories to embedding model '${currentModel}'. ${currentModelCount}/${totalCount} already using this model.`);

        const outdatedRecords = database.getMemoriesByModel('');

        if (outdatedRecords.length === 0) {
            return;
        }

        let migrated = 0;
        let failed = 0;

        for (const record of outdatedRecords) {
            try {
                const embedding = await this.#embed(record.messageText);
                database.updateMemoryEmbeddingModel(record.id, currentModel, embedding);
                migrated++;
            } catch (error) {
                this.#logger.error(`Failed to re-embed memory ${record.id}:`, error);
                failed++;
            }
        }

        this.#logger.info(`Embedding model migration complete. Migrated: ${migrated}, Failed: ${failed}.`);
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