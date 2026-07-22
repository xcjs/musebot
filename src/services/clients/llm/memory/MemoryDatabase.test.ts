import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MemoryDatabase } from './MemoryDatabase.js';

function mockLogger() {
    return {
        debug: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
    };
}

describe('MemoryDatabase', () => {
    let db: MemoryDatabase;
    let dbPath: string;
    const logger = mockLogger();
    const embeddingDimensions = 3;

    function fakeEmbedding(index: number): number[] {
        return [0.1 * index, 0.2 * index, 0.3 * index];
    }

    // storeMemory signature: (llmChatMessageJson, messageText, userId, serverId, isBot, embeddingModel, discordMessageId, embedding)
    function store(db: MemoryDatabase, content: string, userId: string, serverId: string, 
        isBot: boolean, model: string, msgId: string): number | null {
        const json = JSON.stringify({ role: 'user', content, userId, serverId });
        return db.storeMemory(json, content, userId, serverId, isBot, model, msgId, fakeEmbedding(Math.random()));
    }

    beforeEach(() => {
        dbPath = join(tmpdir(), `musebot-test-memory-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
        db = new MemoryDatabase(dbPath, embeddingDimensions, logger);
    });

    afterEach(() => {
        try { db.close(); } catch { /* ignore */ }
    });

    describe('constructor', () => {
        it('should create database without throwing', () => {
            expect(db).toBeDefined();
        });

        it('should set up tables so consent queries work immediately', () => {
            expect(db.hasConsent('user-1')).toBe(false);
        });

        it('should initialize an empty memory store', () => {
            expect(db.getTotalMemoryCount()).toBe(0);
            expect(db.getIncompleteBackfillUserIds()).toEqual([]);
            expect(db.getAllConsentingUserIds()).toEqual([]);
        });
    });

    describe('consent CRUD', () => {
        it('should track consent state', () => {
            expect(db.hasConsent('user-1')).toBe(false);
            db.setConsent('user-1');
            expect(db.hasConsent('user-1')).toBe(true);
        });

        it('should handle multiple users independently', () => {
            db.setConsent('user-a');
            db.setConsent('user-b');
            expect(db.hasConsent('user-a')).toBe(true);
            expect(db.hasConsent('user-b')).toBe(true);
            expect(db.hasConsent('user-c')).toBe(false);
        });

        it('should remove consent', () => {
            db.setConsent('user-1');
            db.removeConsent('user-1');
            expect(db.hasConsent('user-1')).toBe(false);
        });

        it('should delete memories when removing consent', () => {
            db.setConsent('user-1');
            store(db, 'test content', 'user-1', 'server-1', false, 'all-minilm', 'msg-delete-me');
            expect(db.getTotalMemoryCount()).toBe(1);
            db.removeConsent('user-1');
            expect(db.getTotalMemoryCount()).toBe(0);
        });
    });

    describe('backfill tracking', () => {
        it('should start with backfill incomplete', () => {
            db.setConsent('user-1');
            expect(db.isBackfillComplete('user-1')).toBe(false);
        });

        it('should mark backfill complete and track it', () => {
            db.setConsent('user-1');
            db.markBackfillComplete('user-1');
            expect(db.isBackfillComplete('user-1')).toBe(true);
        });

        it('should return incomplete backfill user ids', () => {
            db.setConsent('user-a');
            db.setConsent('user-b');
            db.markBackfillComplete('user-a');

            const incomplete = db.getIncompleteBackfillUserIds();
            expect(incomplete).toContain('user-b');
            expect(incomplete).not.toContain('user-a');
        });

        it('should return empty array when all backfills complete', () => {
            db.setConsent('user-1');
            db.markBackfillComplete('user-1');
            expect(db.getIncompleteBackfillUserIds()).toEqual([]);
        });
    });

    describe('getAllConsentingUserIds', () => {
        it('should return empty when no consent given', () => {
            expect(db.getAllConsentingUserIds()).toEqual([]);
        });

        it('should list all consenting users', () => {
            db.setConsent('user-1');
            db.setConsent('user-2');
            const ids = db.getAllConsentingUserIds();
            expect(ids).toContain('user-1');
            expect(ids).toContain('user-2');
        });

        it('should not include removed users', () => {
            db.setConsent('user-1');
            db.removeConsent('user-1');
            expect(db.getAllConsentingUserIds()).not.toContain('user-1');
        });
    });

    describe('storeMemory and hasMessage', () => {
        it('should store a memory and return rowid', () => {
            const rowid = store(db, 'hello world', 'user-1', 'server-1', false, 'all-minilm', 'msg-1');
            expect(rowid).toBeGreaterThan(0);
        });

        it('should deduplicate by discordMessageId', () => {
            const first = store(db, 'hello', 'user-1', 'server-1', false, 'all-minilm', 'msg-dup');
            expect(first).toBeGreaterThan(0);

            const second = store(db, 'duplicate content', 'user-1', 'server-1', false, 'all-minilm', 'msg-dup');
            expect(second).toBeNull();
            expect(db.getTotalMemoryCount()).toBe(1);
        });

        it('should report hasMessage correctly', () => {
            store(db, 'test', 'user-1', 'server-1', false, 'all-minilm', 'msg-known');
            expect(db.hasMessage('msg-known')).toBe(true);
            expect(db.hasMessage('msg-unknown')).toBe(false);
        });

        it('should handle null discordMessageId', () => {
            const json = JSON.stringify({ role: 'user', content: 'no id' });
            const rowid = db.storeMemory(json, 'no id', 'user-1', 'server-1', false, 'all-minilm', null, fakeEmbedding(1));
            expect(rowid).toBeGreaterThan(0);
        });
    });

    describe('queryMemories', () => {
        it('should return memories for matching userId and serverId', () => {
            store(db, 'relevant memory', 'user-1', 'server-1', false, 'all-minilm', 'msg-q1');
            const results = db.queryMemories(fakeEmbedding(1), 'server-1', 'user-1', 'all-minilm', 5);
            expect(results.length).toBeGreaterThanOrEqual(1);
        });

        it('should NOT return memories from other users (userId scoping)', () => {
            store(db, 'user A memory', 'user-a', 'server-1', false, 'all-minilm', 'msg-a');
            store(db, 'user B memory', 'user-b', 'server-1', false, 'all-minilm', 'msg-b');

            // Query for user-a only — userId is a DB-level filter so results can't contain user-b's data
            const resultsA = db.queryMemories(fakeEmbedding(1), 'server-1', 'user-a', 'all-minilm', 5);
            const resultsB = db.queryMemories(fakeEmbedding(1), 'server-1', 'user-b', 'all-minilm', 5);

            // Each user should only see their own memories
            if (resultsA.length > 0) {
                expect(resultsA[0].content).toContain('user A memory');
            }
            if (resultsB.length > 0) {
                expect(resultsB[0].content).toContain('user B memory');
            }
        });

        it('should filter by embeddingModel', () => {
            store(db, 'model A memory', 'user-1', 'server-1', false, 'all-minilm', 'model-a-msg');
            store(db, 'model B memory', 'user-1', 'server-1', false, 'nomic-embed', 'model-b-msg');

            // Query with all-minilm should not return nomic-embed memories (embeddingModel is a DB filter)
            const resultsAllMinilm = db.queryMemories(fakeEmbedding(1), 'server-1', 'user-1', 'all-minilm', 5);
            for (const record of resultsAllMinilm) {
                expect(record.content).not.toContain('model B memory');
            }

            const resultsNomic = db.queryMemories(fakeEmbedding(1), 'server-1', 'user-1', 'nomic-embed', 5);
            for (const record of resultsNomic) {
                expect(record.content).not.toContain('model A memory');
            }
        });

        it('should respect topK limit', () => {
            for (let i = 0; i < 10; i++) {
                store(db, `memory ${i}`, 'user-1', 'server-1', false, 'all-minilm', `msg-${i}`);
            }

            const results = db.queryMemories(fakeEmbedding(1), 'server-1', 'user-1', 'all-minilm', 3);
            expect(results.length).toBeLessThanOrEqual(3);
        });

        it('should return empty array when no memories exist', () => {
            const results = db.queryMemories(fakeEmbedding(1), 'server-1', 'user-1', 'all-minilm', 5);
            expect(results).toEqual([]);
        });
    });

    describe('getLatestMemoryTimestamp', () => {
        it('should return null when no memories exist', () => {
            expect(db.getLatestMemoryTimestamp('user-1')).toBeNull();
        });

        it('should return the latest memory timestamp as string', () => {
            store(db, 'memory for user-1', 'user-1', 'server-1', false, 'all-minilm', 'msg-ts');
            const latest = db.getLatestMemoryTimestamp('user-1');
            expect(typeof latest).toBe('string');
            expect(latest).toBeTruthy();
        });

        it('should return null for user with no memories', () => {
            store(db, 'memory for other user', 'other-user', 'server-1', false, 'all-minilm', 'msg-other');
            expect(db.getLatestMemoryTimestamp('user-without-memories')).toBeNull();
        });
    });

    describe('memory counts', () => {
        it('should count total memories across all users', () => {
            store(db, 'mem1', 'user-1', 'server-1', false, 'all-minilm', 'msg-tc-1');
            store(db, 'mem2', 'user-2', 'server-1', false, 'all-minilm', 'msg-tc-2');
            expect(db.getTotalMemoryCount()).toBe(2);
        });

        it('should count memories by embedding model', () => {
            store(db, 'a', 'user-1', 'server-1', false, 'model-a', 'msg-m-a');
            store(db, 'b', 'user-1', 'server-1', false, 'model-b', 'msg-m-b');

            expect(db.getMemoryCountByModel('model-a')).toBe(1);
            expect(db.getMemoryCountByModel('model-b')).toBe(1);
            expect(db.getMemoryCountByModel('nonexistent')).toBe(0);
        });
    });

    describe('getMemoriesByModel', () => {
        it('should return memories for a specific model', () => {
            store(db, 'old model', 'user-1', 'server-1', false, '', 'msg-empty');
            store(db, 'new model', 'user-1', 'server-1', false, 'all-minilm', 'msg-named');

            const emptyModel = db.getMemoriesByModel('');
            expect(emptyModel.length).toBe(1);
            expect(emptyModel[0].messageText).toBe('old model');

            const namedModel = db.getMemoriesByModel('all-minilm');
            expect(namedModel.length).toBe(1);
        });
    });

    describe('vector operations', () => {
        it('should delete vectors by rowids', () => {
            const rowid = store(db, 'to delete', 'user-1', 'server-1', false, 'all-minilm', 'msg-del-vec');
            expect(rowid).toBeGreaterThan(0);

            db.deleteVectorsByRowids([rowid!]);
            // Should not throw
        });

        it('should handle empty rowids array', () => {
            expect(() => db.deleteVectorsByRowids([])).not.toThrow();
        });

        it('should update memory embedding model', () => {
            const rowid = store(db, 'update me', 'user-1', 'server-1', false, 'old-model', 'msg-update');
            expect(rowid).toBeGreaterThan(0);

            db.updateMemoryEmbeddingModel(rowid!, 'new-model', fakeEmbedding(99));

            // Verify the model was updated
            expect(db.getMemoryCountByModel('new-model')).toBe(1);
            expect(db.getMemoryCountByModel('old-model')).toBe(0);
        });
    });

    describe('close', () => {
        it('should close without throwing', () => {
            expect(() => db.close()).not.toThrow();
        });
    });
});
