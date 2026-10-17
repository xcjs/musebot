import { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../features/IFeatureService.js';
import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { ILogger } from '../../../ILogger.js';
import { LlmRole } from '../enums/LlmRole.js';
import { ILlmClient } from '../ILlmClient.js';
import { LlmChatMessage } from '../models/LlmChatMessage.js';
import { LlmMessage } from '../models/LlmMessage.js';
import { IMemoryService } from '../services/IMemoryService.js';
import { MemoryDatabase, MemoryRecord } from './MemoryDatabase.js';

const MEMORY_DATABASE_DIR = 'workflows';
const MEMORY_DATABASE_FILENAME = 'txt2txt/memory.db';

export class MemoryService implements IMemoryService {
  readonly #services: IBotServiceContainer;
  readonly #configurationService: IConfigurationService;
  readonly #featureService: IFeatureService;
  readonly #logger: ILogger;

  #databasePromise: Promise<MemoryDatabase> | null = null;
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
    if (!this.isEnabled) {
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
      const json = JSON.stringify(llmChatMessage);
      const embedding = await this.#embedToVector(json);
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
        embedding,
        { createdAt: llmChatMessage.datetime });

      if (rowId === null) {
        this.#logger.debug(`store() deduped: messageId=${llmChatMessage.messageId} already exists.`);
      } else {
        this.#logger.debug(`store() inserted: messageId=${llmChatMessage.messageId} rowId=${rowId}.`);
      }
    } catch (error) {
      this.#logger.error(`Failed to store memory for user ${consentUserId} (messageId=${llmChatMessage.messageId}):`, error);
    }
  }

  async retrieve(llmChatMessage: LlmChatMessage): Promise<LlmMessage[]> {
    if (!this.isEnabled) {
      return [];
    }

    const serverId = llmChatMessage.server.id;

    if (serverId === null) {
      return [];
    }

    try {
      const json = JSON.stringify(llmChatMessage);
      const embedding = await this.#embedToVector(json);
      const topK = this.#configurationService.llmTopK;
      const embeddingModel = this.#getEmbeddingModel();
      const database = await this.#getDatabase();
      const records = database.queryMemories(embedding, serverId, embeddingModel, topK);

      if (records.length === 0) {
        return [];
      }

      const memoryText = records.map((record: MemoryRecord) => record.content).join('\n\n');
      const systemMessage: LlmMessage = {
        role: LlmRole.System,
        content: `The following are relevant memories from past conversations in this server:\n\n${memoryText}`
      };

      return [systemMessage];
    } catch (error) {
      this.#logger.error('Failed to retrieve memories:', error);
      return [];
    }
  }

  #getEmbeddingModel(): string {
    const model = this.#configurationService.llmEmbeddingModel;
    if (model === null) {
      throw new Error('Embedding model is not configured but LTM is enabled.');
    }
    return model;
  }

  async #embedToVector(text: string): Promise<number[]> {
    const client: ILlmClient = this.#services.llmClient;
    const chunks = this.#splitEmbeddingInput(text);

    if (chunks.length === 1) {
      return await client.embed(chunks[0]);
    }

    const vectors = await client.embedBatch(chunks);

    if (vectors.length !== chunks.length) {
      throw new Error(`The LLM API returned ${vectors.length} embeddings for ${chunks.length} embedding input chunks.`);
    }

    return vectors.length === 1 ? vectors[0] : this.#poolVectors(vectors);
  }

  #splitEmbeddingInput(text: string): string[] {
    const limit = Math.max(1, this.#configurationService.llmEmbeddingInputLimit);
    const chunks: string[] = [];

    for (let offset = 0; offset < text.length; offset += limit) {
      chunks.push(text.slice(offset, offset + limit));
    }

    return chunks;
  }

  #poolVectors(vectors: number[][]): number[] {
    const pooled = new Array<number>(vectors[0].length).fill(0);

    for (const vector of vectors) {
      if (vector.length !== pooled.length) {
        throw new Error('The LLM API returned embeddings of inconsistent dimensions for one input.');
      }

      for (let index = 0; index < pooled.length; index++) {
        pooled[index] += vector[index];
      }
    }

    return pooled.map((value) => value / vectors.length);
  }

  /**
   * Resolves once the initial database open and migration have completed.
   * Tests and shutdown paths use this to await background migration work.
   */
  async waitForInitialMigration(): Promise<void> {
    await this.#getDatabase();
  }

  async closeDatabase(): Promise<void> {
    if (this.#databasePromise === null) {
      return;
    }

    try {
      const database = await this.#databasePromise;
      database.close();
    } catch (error) {
      this.#logger.error('Failed to close the memory database:', error);
    } finally {
      this.#databasePromise = null;
    }
  }

  async #getDatabase(): Promise<MemoryDatabase> {
    if (this.#databasePromise !== null) {
      return await this.#databasePromise;
    }

    this.#databasePromise = (async (): Promise<MemoryDatabase> => {
      const dimensions = await this.#getEmbeddingDimensions();
      const dbPath = `${MEMORY_DATABASE_DIR}/${this.#configurationService.botId}/${MEMORY_DATABASE_FILENAME}`;
      const database = new MemoryDatabase(dbPath, dimensions, this.#logger);

      try {
        await this.#migrateEmbeddingModel(database);
      } catch (error) {
        this.#logger.error('Initial memory migration failed:', error);
      }

      return database;
    })();

    return await this.#databasePromise;
  }

  async #migrateEmbeddingModel(database: MemoryDatabase): Promise<void> {
    const currentModel = this.#getEmbeddingModel();
    const batchSize = 32;

    let afterId = 0;
    let migrated = 0;
    let failed = 0;

    // Paged, batched re-embed: rows whose embedding model differs OR whose
    // stored embedding was computed from raw message text rather than the
    // full serialized LlmChatMessage JSON. While re-embedding, repair legacy
    // createdAt values (previously insertion time, not message time).
    for (;;) {
      const records = database.getMemoriesNeedingReembed(currentModel, afterId, batchSize);
      if (records.length === 0) {
        break;
      }

      const chunkLists = records.map((record) => this.#splitEmbeddingInput(record.llmChatMessageJson));
      const client: ILlmClient = this.#services.llmClient;
      const flatChunks = chunkLists.flat();
      const chunkVectors = await client.embedBatch(flatChunks);

      if (chunkVectors.length !== flatChunks.length) {
        throw new Error(`The LLM API returned ${chunkVectors.length} embeddings for ${flatChunks.length} embedding input chunks.`);
      }

      let offset = 0;

      for (let index = 0; index < records.length; index++) {
        const record = records[index];
        const vectors = chunkVectors.slice(offset, offset + chunkLists[index].length);
        const embedding = vectors.length === 1 ? vectors[0] : this.#poolVectors(vectors);
        offset += chunkLists[index].length;

        if (embedding === undefined || embedding.length === 0) {
          this.#logger.error(`Re-embed batch returned no embedding for memory ${record.id}; skipping.`);
          failed++;
          continue;
        }

        try {
          const createdAt = this.#parseMessageDatetime(record.llmChatMessageJson);
          database.updateMemoryEmbedding(record.id, currentModel, embedding, createdAt);
          migrated++;
        } catch (error) {
          this.#logger.error(`Failed to update memory ${record.id} during re-embed:`, error);
          failed++;
        }
      }

      afterId = records[records.length - 1].id;
    }

    if (migrated > 0 || failed > 0) {
      this.#logger.info(`Memory re-embed migration complete. Migrated: ${migrated}, Failed: ${failed}.`);
    }
  }

  #parseMessageDatetime(llmChatMessageJson: string): string | null {
    try {
      const parsed = JSON.parse(llmChatMessageJson) as { datetime?: unknown };
      const datetime = parsed.datetime;
      return typeof datetime === 'string' ? datetime : null;
    } catch {
      return null;
    }
  }

  async #getEmbeddingDimensions(): Promise<number> {
    if (this.#embeddingDimensions !== null) {
      return this.#embeddingDimensions;
    }

    const embedding = await this.#embedToVector('dimension probe');
    this.#embeddingDimensions = embedding.length;
    this.#logger.info(`Detected embedding dimensions: ${this.#embeddingDimensions}`);

    return this.#embeddingDimensions;
  }
}