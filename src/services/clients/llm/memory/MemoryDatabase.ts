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
                consentedAt TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS LlmChatMessage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                serverId TEXT,
                content TEXT NOT NULL,
                messageText TEXT NOT NULL,
                isBot INTEGER NOT NULL,
                createdAt TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_LlmChatMessage_userId ON LlmChatMessage(userId);
            CREATE INDEX IF NOT EXISTS idx_LlmChatMessage_serverId ON LlmChatMessage(serverId);
        `);

        const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
        this.#db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS ${vecTable} USING vec0(embedding float[${this.#embeddingDimensions}]);
        `);
    }

    hasConsent(userId: string): boolean {
        const row = this.#drizzle.select().from(UserConsent).where(eq(UserConsent.userId, userId)).get();
        return row !== undefined;
    }

    setConsent(userId: string): void {
        const consentedAt = new Date().toISOString();
        this.#drizzle.insert(UserConsent)
            .values({ userId, consentedAt })
            .onConflictDoUpdate({ target: UserConsent.userId, set: { consentedAt } })
            .run();
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
        embedding: number[]): number {
        const createdAt = new Date().toISOString();
        const result = this.#drizzle.insert(LlmChatMessageRecord)
            .values({
                userId,
                serverId,
                content: llmChatMessageJson,
                messageText,
                isBot,
                createdAt
            })
            .run();

        const rowid = Number(result.lastInsertRowid);
        const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
        this.#db.prepare(`INSERT INTO ${vecTable}(rowid, embedding) VALUES (?, ?)`)
            .run(rowid, JSON.stringify(embedding));

        return rowid;
    }

    queryMemories(embedding: number[], serverId: string, topK: number): MemoryRecord[] {
        const vecTable = `LlmChatMessage_vec_${this.#embeddingDimensions}`;
        const stmt = this.#db.prepare(`
            SELECT vec.rowid, vec.distance, msg.content
            FROM ${vecTable} vec
            JOIN LlmChatMessage msg ON msg.id = vec.rowid
            WHERE vec.embedding MATCH ?
              AND vec.k = ?
              AND msg.serverId = ?
            ORDER BY vec.distance
            LIMIT ?
        `);

        return stmt.all(JSON.stringify(embedding), topK, serverId, topK) as MemoryRecord[];
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

    close(): void {
        this.#db.close();
        this.#logger.info('Memory database closed.');
    }
}