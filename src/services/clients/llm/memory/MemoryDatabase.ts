import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { load } from 'sqlite-vec';

import { ILogger } from '../../../ILogger.js';
import { LlmChatMessageRecord, UserConsent } from './schema.js';

export interface MemoryRecord {
    id: number;
    content: string;
    distance: number;
}

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
        load(this.#db);

        this.#drizzle = drizzle(this.#db, { schema: { UserConsent, LlmChatMessageRecord } });

        this.#initialize();
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
            CREATE UNIQUE INDEX IF NOT EXISTS idx_LlmChatMessage_discordMessageId ON LlmChatMessage(discordMessageId) WHERE discordMessageId IS NOT NULL;
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

        if (!hasEmbeddingModel) {
            this.#db.exec('ALTER TABLE LlmChatMessage ADD COLUMN embeddingModel TEXT NOT NULL DEFAULT \'\'');
            this.#logger.info('Added embeddingModel column to LlmChatMessage table.');
        }

        if (!hasDiscordMessageId) {
            this.#db.exec('ALTER TABLE LlmChatMessage ADD COLUMN discordMessageId TEXT');
            this.#logger.info('Added discordMessageId column to LlmChatMessage table.');
        }

        const consentColumns = this.#db.prepare('PRAGMA table_info(UserConsent)').all() as Array<{ name: string }>;
        const hasBackfillCompleted = consentColumns.some(c => c.name === 'backfillCompleted');

        if (!hasBackfillCompleted) {
            this.#db.exec('ALTER TABLE UserConsent ADD COLUMN backfillCompleted INTEGER NOT NULL DEFAULT 0');
            this.#logger.info('Added backfillCompleted column to UserConsent table.');
        }

        this.#db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_LlmChatMessage_discordMessageId ON LlmChatMessage(discordMessageId) WHERE discordMessageId IS NOT NULL');
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
        this.#deleteMemoriesByUser(userId);
        this.#drizzle.delete(UserConsent).where(eq(UserConsent.userId, userId)).run();
    }

    storeMemory(
        llmChatMessageJson: string,
        messageText: string,
        userId: string,
        serverId: string | null,
        isBot: boolean,
        embeddingModel: string,
        discordMessageId: string | null,
        embedding: number[]): number | null {
        if (discordMessageId !== null) {
            const existing = this.#db.prepare(
                'SELECT id FROM LlmChatMessage WHERE discordMessageId = ?'
            ).get(discordMessageId) as { id: number } | undefined;

            if (existing !== undefined) {
                return null;
            }
        }

        const createdAt = new Date().toISOString();
        this.#drizzle.insert(LlmChatMessageRecord)
            .values({
                userId,
                serverId,
                content: llmChatMessageJson,
                messageText,
                isBot,
                embeddingModel,
                discordMessageId,
                createdAt
            })
            .run();

        const rowidRow = this.#db.prepare('SELECT last_insert_rowid() AS rowid').get() as { rowid: number };
        const rowid = rowidRow.rowid;

        const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
        this.#db.prepare(`INSERT INTO ${vecTable}(rowid, embedding) VALUES ((SELECT last_insert_rowid()), ?)`)
            .run(JSON.stringify(embedding));

        return rowid;
    }

    queryMemories(embedding: number[], serverId: string, embeddingModel: string, topK: number): MemoryRecord[] {
        const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
        const stmt = this.#db.prepare(`
            SELECT vec.rowid, vec.distance, msg.content
            FROM ${vecTable} vec
            JOIN LlmChatMessage msg ON msg.id = vec.rowid
            WHERE vec.embedding MATCH ?
              AND vec.k = ?
              AND msg.serverId = ?
              AND msg.embeddingModel = ?
            ORDER BY vec.distance
        `);

        return stmt.all(JSON.stringify(embedding), topK, serverId, embeddingModel) as MemoryRecord[];
    }

    #deleteMemoriesByUser(userId: string): void {
        const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
        const rowids = this.#drizzle.select({ id: LlmChatMessageRecord.id })
            .from(LlmChatMessageRecord)
            .where(eq(LlmChatMessageRecord.userId, userId))
            .all();

        if (rowids.length === 0) {
            return;
        }

        const placeholders = rowids.map(() => '?').join(',');
        this.#db.prepare(`DELETE FROM ${vecTable} WHERE rowid IN (${placeholders})`)
            .run(...rowids.map(r => r.id));

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

    deleteVectorsByRowids(rowids: number[]): void {
        if (rowids.length === 0) {
            return;
        }

        const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
        const placeholders = rowids.map(() => '?').join(',');
        this.#db.prepare(`DELETE FROM ${vecTable} WHERE rowid IN (${placeholders})`)
            .run(...rowids);
    }

    updateMemoryEmbeddingModel(id: number, embeddingModel: string, embedding: number[]): void {
        const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
        this.#db.prepare(`DELETE FROM ${vecTable} WHERE rowid = ?`).run(id);
        this.#db.prepare(`INSERT INTO ${vecTable}(rowid, embedding) VALUES (?, ?)`)
            .run(id, JSON.stringify(embedding));
        this.#db.prepare('UPDATE LlmChatMessage SET embeddingModel = ? WHERE id = ?')
            .run(embeddingModel, id);
    }

    close(): void {
        this.#db.close();
        this.#logger.info('Memory database closed.');
    }
}