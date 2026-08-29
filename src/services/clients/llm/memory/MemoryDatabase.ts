import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';

import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { getLoadablePath } from 'sqlite-vec';

import { ILogger } from '../../../ILogger.js';
import { LlmChatMessageRecord, UserConsent } from './schema.js';

export interface MemoryRecord {
  id: number;
  content: string;
  distance: number;
}

let vecExtensionTempPath: string | null = null;

export class MemoryDatabase {
  readonly #db: Database.Database;
  readonly #drizzle: BetterSQLite3Database<Record<string, unknown>>;
  readonly #logger: ILogger;
  readonly #embeddingDimensions: number;

  constructor(databasePath: string, embeddingDimensions: number, logger: ILogger) {
    this.#logger = logger;
    this.#embeddingDimensions = embeddingDimensions;

    const directory = dirname(databasePath);
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
      this.#logger.info(`Created memory database directory: ${directory}`);
    }

    this.#db = new Database(databasePath);
    this.#loadVecExtension();

    this.#drizzle = drizzle(this.#db, { schema: { UserConsent, LlmChatMessageRecord } });

    this.#initialize();
  }

  #loadVecExtension(): void {
    const loadablePath = getLoadablePath();

    if (!('pkg' in process) || !(process as { pkg?: unknown }).pkg) {
      this.#db.loadExtension(loadablePath);
      return;
    }

    if (vecExtensionTempPath === null) {
      const tempDir = join(tmpdir(), 'musebot');
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }

      vecExtensionTempPath = join(tempDir, `vec0${extname(loadablePath)}`);
      writeFileSync(vecExtensionTempPath, readFileSync(loadablePath));
      this.#logger.info(`Wrote sqlite-vec extension to '${vecExtensionTempPath}'.`);
    }

    (this.#db as unknown as { loadExtension(path: string, entryPoint: string): void })
      .loadExtension(vecExtensionTempPath, 'sqlite3_vec_init');
  }

  #initialize(): void {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS UserConsent (
        userId TEXT PRIMARY KEY,
        consentedAt TEXT NOT NULL,
        backfillCompleted INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS LlmChatMessage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        serverId TEXT,
        content TEXT NOT NULL,
        messageText TEXT NOT NULL,
        isBot INTEGER NOT NULL,
        embeddingModel TEXT NOT NULL,
        discordMessageId TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_LlmChatMessage_userId ON LlmChatMessage(userId);
      CREATE INDEX IF NOT EXISTS idx_LlmChatMessage_serverId ON LlmChatMessage(serverId);
      CREATE INDEX IF NOT EXISTS idx_LlmChatMessage_embeddingModel ON LlmChatMessage(embeddingModel);
    `);

    this.#migrateExistingDb();

    const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
    this.#db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${vecTable} USING vec0(embedding float[${this.#embeddingDimensions}]);
    `);
  }

  #migrateExistingDb(): void {
    const msgColumns = this.#db.prepare('PRAGMA table_info(LlmChatMessage)').all() as Array<{ name: string }>;
    const hasEmbeddingModel = msgColumns.some(c => c.name === 'embeddingModel');
    const hasDiscordMessageId = msgColumns.some(c => c.name === 'discordMessageId');
    const hasEmbeddingSource = msgColumns.some(c => c.name === 'embeddingSource');

    if (!hasEmbeddingModel) {
      this.#db.exec('ALTER TABLE LlmChatMessage ADD COLUMN embeddingModel TEXT NOT NULL DEFAULT \'\'');
      this.#logger.info('Added embeddingModel column to LlmChatMessage table.');
    }

    if (!hasDiscordMessageId) {
      this.#db.exec('ALTER TABLE LlmChatMessage ADD COLUMN discordMessageId TEXT');
      this.#logger.info('Added discordMessageId column to LlmChatMessage table.');
    }

    if (!hasEmbeddingSource) {
      // 'message' marks rows embedded from raw message text (pre-JSON era);
      // migration re-embeds them from the stored JSON serialization.
      this.#db.exec('ALTER TABLE LlmChatMessage ADD COLUMN embeddingSource TEXT NOT NULL DEFAULT \'message\'');
      this.#logger.info('Added embeddingSource column to LlmChatMessage table.');
    }

    // The original global unique index on discordMessageId misattributed bot
    // replies stored on behalf of multiple users; the dedupe scope is per user.
    this.#db.exec('DROP INDEX IF EXISTS idx_LlmChatMessage_discordMessageId');
    this.#db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_LlmChatMessage_userId_discordMessageId ON LlmChatMessage(userId, discordMessageId) WHERE discordMessageId IS NOT NULL');

    const consentColumns = this.#db.prepare('PRAGMA table_info(UserConsent)').all() as Array<{ name: string }>;
    const hasBackfillCompleted = consentColumns.some(c => c.name === 'backfillCompleted');

    if (!hasBackfillCompleted) {
      this.#db.exec('ALTER TABLE UserConsent ADD COLUMN backfillCompleted INTEGER NOT NULL DEFAULT 0');
      this.#logger.info('Added backfillCompleted column to UserConsent table.');
    }
  }

  hasMessage(discordMessageId: string): boolean {
    const existing = this.#db.prepare(
      'SELECT id FROM LlmChatMessage WHERE discordMessageId = ?'
    ).get(discordMessageId) as { id: number } | undefined;
    return existing !== undefined;
  }

  hasConsent(userId: string): boolean {
    const row = this.#drizzle.select().from(UserConsent).where(eq(UserConsent.userId, userId)).get();
    return row !== undefined;
  }

  setConsent(userId: string): void {
    const consentedAt = new Date().toISOString();
    this.#drizzle.insert(UserConsent)
      .values({ userId, consentedAt, backfillCompleted: false })
      .onConflictDoUpdate({ target: UserConsent.userId, set: { consentedAt, backfillCompleted: false } })
      .run();
  }

  isBackfillComplete(userId: string): boolean {
    const row = this.#drizzle.select().from(UserConsent).where(eq(UserConsent.userId, userId)).get();
    return row?.backfillCompleted ?? false;
  }

  markBackfillComplete(userId: string): void {
    this.#drizzle.update(UserConsent)
      .set({ backfillCompleted: true })
      .where(eq(UserConsent.userId, userId))
      .run();
  }

  getIncompleteBackfillUserIds(): string[] {
    const rows = this.#drizzle.select({ userId: UserConsent.userId })
      .from(UserConsent)
      .where(eq(UserConsent.backfillCompleted, false))
      .all();
    return rows.map(r => r.userId);
  }

  getLatestMemoryTimestamp(userId: string): string | null {
    const row = this.#db.prepare(
      'SELECT createdAt FROM LlmChatMessage WHERE userId = ? ORDER BY createdAt DESC LIMIT 1'
    ).get(userId) as { createdAt: string } | undefined;
    return row?.createdAt ?? null;
  }

  getAllConsentingUserIds(): string[] {
    const rows = this.#drizzle.select({ userId: UserConsent.userId })
      .from(UserConsent)
      .all();
    return rows.map(r => r.userId);
  }

  removeConsent(userId: string): void {
    const transaction = this.#db.transaction((id: string) => {
      this.#deleteMemoriesByUser(id);
      this.#drizzle.delete(UserConsent).where(eq(UserConsent.userId, id)).run();
    });
    transaction(userId);
  }

  storeMemory(
    llmChatMessageJson: string,
    messageText: string,
    userId: string,
    serverId: string | null,
    isBot: boolean,
    embeddingModel: string,
    discordMessageId: string | null,
    embedding: number[],
    options: { createdAt?: string; embeddingSource?: string } = {}): number | null {
    this.#logger.debug(`storeMemory() called: discordMessageId=${discordMessageId}, userId=${userId}, isBot=${isBot}.`);

    const store = this.#db.transaction(() => {
      if (discordMessageId !== null) {
        const existing = this.#db.prepare(
          'SELECT id FROM LlmChatMessage WHERE userId = ? AND discordMessageId = ?'
        ).get(userId, discordMessageId) as { id: number } | undefined;

        if (existing !== undefined) {
          this.#logger.debug(`storeMemory() deduped: discordMessageId=${discordMessageId} matched existing row id=${existing.id}.`);
          return null;
        }
      }

      const createdAt = options.createdAt ?? new Date().toISOString();
      const embeddingSource = options.embeddingSource ?? 'json';
      this.#drizzle.insert(LlmChatMessageRecord)
        .values({
          userId,
          serverId,
          content: llmChatMessageJson,
          messageText,
          isBot,
          embeddingModel,
          embeddingSource,
          discordMessageId,
          createdAt
        })
        .run();

      const rowidRow = this.#db.prepare('SELECT last_insert_rowid() AS rowid').get() as { rowid: number };
      const rowid = rowidRow.rowid;

      const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
      this.#db.prepare(`INSERT INTO ${vecTable}(rowid, embedding) VALUES ((SELECT last_insert_rowid()), ?)`)
        .run(JSON.stringify(embedding));

      this.#logger.debug(`storeMemory() inserted row id=${rowid} for discordMessageId=${discordMessageId}.`);

      return rowid;
    });

    return store();
  }

  queryMemories(embedding: number[], serverId: string, embeddingModel: string, topK: number): MemoryRecord[] {
    const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;

    // vec0 applies its KNN limit before the JOIN filters below, so vectors from
    // other servers or embedding models can consume the top-K slots and starve
    // the requested server. Over-fetch and re-rank against the filtered rows.
    const fetchK = topK * 4;
    const stmt = this.#db.prepare(`
      SELECT vec.rowid, vec.distance, msg.content
      FROM ${vecTable} vec
      JOIN LlmChatMessage msg ON msg.id = vec.rowid
      WHERE vec.embedding MATCH ?
              AND vec.k = ?
              AND msg.serverId = ?
              AND msg.embeddingModel = ?
      ORDER BY vec.distance
      LIMIT ?
    `);

    return (stmt.all(JSON.stringify(embedding), fetchK, serverId, embeddingModel, topK) as MemoryRecord[]);
  }

  #deleteMemoriesByUser(userId: string): void {
    const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
    // Subselect instead of an IN (…) parameter list: users with long histories
    // exceed SQLite's 32,766 bound-parameter limit otherwise.
    this.#db.prepare(`DELETE FROM ${vecTable} WHERE rowid IN (SELECT id FROM LlmChatMessage WHERE userId = ?)`)
      .run(userId);

    this.#drizzle.delete(LlmChatMessageRecord).where(eq(LlmChatMessageRecord.userId, userId)).run();
  }

  getMemoryCountByModel(embeddingModel: string): number {
    const row = this.#db.prepare(
      'SELECT COUNT(*) AS count FROM LlmChatMessage WHERE embeddingModel = ?'
    ).get(embeddingModel) as { count: number };
    return row.count;
  }

  getTotalMemoryCount(): number {
    const row = this.#db.prepare('SELECT COUNT(*) AS count FROM LlmChatMessage').get() as { count: number };
    return row.count;
  }

  getMemoriesByModel(embeddingModel: string): Array<{ id: number; messageText: string; llmChatMessageJson: string; userId: string; serverId: string | null; isBot: number }> {
    return this.#db.prepare(
      'SELECT id, messageText, content AS llmChatMessageJson, userId, serverId, isBot FROM LlmChatMessage WHERE embeddingModel = ?'
    ).all(embeddingModel) as Array<{ id: number; messageText: string; llmChatMessageJson: string; userId: string; serverId: string | null; isBot: number }>;
  }

  getMemoriesNotUsingModel(embeddingModel: string): Array<{ id: number; messageText: string; llmChatMessageJson: string; userId: string; serverId: string | null; isBot: number }> {
    return this.#db.prepare(
      'SELECT id, messageText, content AS llmChatMessageJson, userId, serverId, isBot FROM LlmChatMessage WHERE embeddingModel != ?'
    ).all(embeddingModel) as Array<{ id: number; messageText: string; llmChatMessageJson: string; userId: string; serverId: string | null; isBot: number }>;
  }

  getMemoriesNeedingReembed(embeddingModel: string, afterId: number, limit: number): Array<{ id: number; userId: string; serverId: string | null; isBot: number; llmChatMessageJson: string; createdAt: string }> {
    return this.#db.prepare(
      'SELECT id, userId, serverId, isBot, content AS llmChatMessageJson, createdAt FROM LlmChatMessage'
      + ' WHERE (embeddingModel != ? OR embeddingSource != ?) AND id > ? ORDER BY id LIMIT ?'
    ).all(embeddingModel, 'json', afterId, limit) as Array<{ id: number; userId: string; serverId: string | null; isBot: number; llmChatMessageJson: string; createdAt: string }>;
  }

  deleteVectorsByRowids(rowids: number[]): void {
    if (rowids.length === 0) {
      return;
    }

    const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
    const placeholders = rowids.map(() => '?').join(',');
    this.#db.prepare(`DELETE FROM ${vecTable} WHERE rowid IN (${placeholders})`)
      .run(...rowids);
  }

  updateMemoryEmbedding(id: number, embeddingModel: string, embedding: number[], createdAt: string | null): void {
    const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
    const update = this.#db.transaction(() => {
      this.#db.prepare(`DELETE FROM ${vecTable} WHERE rowid = ?`).run(id);
      // vec0 rejects bound parameters for the rowid column; id is an internal
      // integer primary key, so inline it.
      this.#db.prepare(`INSERT INTO ${vecTable}(rowid, embedding) VALUES (${id}, ?)`)
        .run(JSON.stringify(embedding));
      if (createdAt !== null) {
        this.#db.prepare('UPDATE LlmChatMessage SET embeddingModel = ?, embeddingSource = ?, createdAt = ? WHERE id = ?')
          .run(embeddingModel, 'json', createdAt, id);
      } else {
        this.#db.prepare('UPDATE LlmChatMessage SET embeddingModel = ?, embeddingSource = ? WHERE id = ?')
          .run(embeddingModel, 'json', id);
      }
    });
    update();
  }

  close(): void {
    this.#db.close();
    this.#logger.info('Memory database closed.');
  }
}