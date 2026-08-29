import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Database from 'better-sqlite3';
import { getLoadablePath } from 'sqlite-vec';

import { createMockLogger } from '../../../../test-utils/mockBotServiceContainer.js';
import { MemoryDatabase } from './MemoryDatabase.js';

describe('MemoryDatabase', () => {
  let dbPath: string;
  let db: MemoryDatabase;

  beforeEach(() => {
    dbPath = join(mkdtempSync(join(tmpdir(), 'musebot-memory-db-test-')), 'memory.db');
    db = new MemoryDatabase(dbPath, 4, createMockLogger());
  });

  afterEach(() => {
    db.close();
    rmSync(dirname(dbPath), { recursive: true, force: true });
  });

  it('returns the top-K memories for the requested server even when closer memories exist in other servers', () => {
    db.storeMemory('{"id":"b1"}', 'b1', 'user-1', 'server-b', false, 'model', 'dm-b1', [1, 0.02, 0, 0]);
    db.storeMemory('{"id":"b2"}', 'b2', 'user-1', 'server-b', false, 'model', 'dm-b2', [1, 0.01, 0, 0]);
    db.storeMemory('{"id":"b3"}', 'b3', 'user-1', 'server-b', false, 'model', 'dm-b3', [1, 0, 0, 0]);
    db.storeMemory('{"id":"a1"}', 'a1', 'user-1', 'server-a', false, 'model', 'dm-a1', [0, 1, 0, 0]);
    db.storeMemory('{"id":"a2"}', 'a2', 'user-1', 'server-a', false, 'model', 'dm-a2', [0, 0, 1, 0]);

    const results = db.queryMemories([1, 0, 0, 0], 'server-a', 'model', 2);

    expect(results).toHaveLength(2);
    expect(results.map(r => r.content)).toEqual(expect.arrayContaining(['{"id":"a1"}', '{"id":"a2"}']));
  });

  it('rolls back the relational row when the vector insert fails', () => {
    expect(() => db.storeMemory('{"id":"x"}', 'x', 'user-1', 'server-a', false, 'model', 'dm-x', [1, 0.5]))
      .toThrow();

    expect(db.hasMessage('dm-x')).toBe(false);
    expect(db.getTotalMemoryCount()).toBe(0);

    const rowid = db.storeMemory('{"id":"x"}', 'x', 'user-1', 'server-a', false, 'model', 'dm-x', [1, 0, 0, 0]);
    expect(rowid).not.toBeNull();
  });

  it('rolls back the vector delete when updating a memory embedding fails', () => {
    const rowid = db.storeMemory('{"id":"y"}', 'y', 'user-1', 'server-a', false, 'model', 'dm-y', [1, 0, 0, 0]);
    expect(rowid).not.toBeNull();

    expect(() => db.updateMemoryEmbedding(rowid, 'model-b', [1, 0.5], null)).toThrow();

    const results = db.queryMemories([1, 0, 0, 0], 'server-a', 'model', 5);
    expect(results).toHaveLength(1);
    expect(db.getMemoryCountByModel('model-b')).toBe(0);
  });

  it('deletes all memories when a user owns more rows than the SQLite variable limit', () => {
    db.setConsent('user-1');
    seedRawMemories(dbPath, 33000);
    expect(db.getTotalMemoryCount()).toBe(33000);

    db.removeConsent('user-1');

    expect(db.hasConsent('user-1')).toBe(false);
    expect(db.getTotalMemoryCount()).toBe(0);
  });

  it('stores the message datetime as createdAt', () => {
    const messageDatetime = '2025-06-15T12:30:00.000Z';

    db.storeMemory('{"id":"t1"}', 't1', 'user-1', 'server-a', false, 'model', 'dm-t1', [1, 0, 0, 0], { createdAt: messageDatetime });

    const latest = db.getLatestMemoryTimestamp('user-1');
    expect(latest).toBe(messageDatetime);
  });

  it('allows the same discord message id for different users', () => {
    const first = db.storeMemory('{"id":"s1"}', 's1', 'user-1', 'server-a', false, 'model', 'dm-shared', [1, 0, 0, 0]);
    const second = db.storeMemory('{"id":"s2"}', 's2', 'user-2', 'server-a', false, 'model', 'dm-shared', [0, 1, 0, 0]);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
  });

  it('still dedupes the same discord message id for the same user', () => {
    db.storeMemory('{"id":"s1"}', 's1', 'user-1', 'server-a', false, 'model', 'dm-shared', [1, 0, 0, 0]);
    const duplicate = db.storeMemory('{"id":"s2"}', 's2', 'user-1', 'server-a', false, 'model', 'dm-shared', [0, 1, 0, 0]);

    expect(duplicate).toBeNull();
  });

  it('upgrades a legacy global discordMessageId index to the per-user index', () => {
    db.close();

    const raw = new Database(dbPath);
    raw.exec('DROP INDEX IF EXISTS idx_LlmChatMessage_discordMessageId');
    raw.exec("CREATE UNIQUE INDEX idx_LlmChatMessage_discordMessageId ON LlmChatMessage(discordMessageId) WHERE discordMessageId IS NOT NULL AND userId = 'legacy-sentinel'");
    raw.close();

    db = new MemoryDatabase(dbPath, 4, createMockLogger());

    const first = db.storeMemory('{"id":"u1"}', 'u1', 'user-1', 'server-a', false, 'model', 'dm-upgrade', [1, 0, 0, 0]);
    const second = db.storeMemory('{"id":"u2"}', 'u2', 'user-2', 'server-a', false, 'model', 'dm-upgrade', [0, 1, 0, 0]);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
  });

  it('pages through memories needing re-embedding without loading the whole table', () => {
    for (let i = 1; i <= 25; i++) {
      db.storeMemory(`{"id":"p${i}"}`, `p${i}`, 'user-1', 'server-a', false, 'current-model', `dm-p${i}`, [1, 0, 0, 0], { embeddingSource: 'message' });
    }

    const page1 = db.getMemoriesNeedingReembed('current-model', 0, 10);
    expect(page1).toHaveLength(10);

    const page2 = db.getMemoriesNeedingReembed('current-model', page1[page1.length - 1].id, 10);
    expect(page2).toHaveLength(10);
    expect(page2[0].id).toBeGreaterThan(page1[page1.length - 1].id);

    const page3 = db.getMemoriesNeedingReembed('current-model', page2[page2.length - 1].id, 10);
    expect(page3).toHaveLength(5);

    const page4 = db.getMemoriesNeedingReembed('current-model', page3[page3.length - 1].id, 10);
    expect(page4).toHaveLength(0);
  });

  it('updates embedding, model, embedding source, and message datetime together', () => {
    const rowid = db.storeMemory('{"id":"e1"}', 'e1', 'user-1', 'server-a', false, 'legacy-model', 'dm-e1', [1, 0, 0, 0]);
    expect(rowid).not.toBeNull();

    const messageDatetime = '2025-07-01T08:00:00.000Z';
    db.updateMemoryEmbedding(rowid, 'new-model', [0, 1, 0, 0], messageDatetime);

    const results = db.queryMemories([0, 1, 0, 0], 'server-a', 'new-model', 5);
    expect(results).toHaveLength(1);
    expect(db.getMemoryCountByModel('legacy-model')).toBe(0);
    expect(db.getLatestMemoryTimestamp('user-1')).toBe(messageDatetime);

    const source = ((): { embeddingSource: string } => {
      const raw = new Database(dbPath);
      try {
        return raw.prepare('SELECT embeddingSource FROM LlmChatMessage WHERE id = ?').get(rowid) as { embeddingSource: string };
      } finally {
        raw.close();
      }
    })();
    expect(source.embeddingSource).toBe('json');
  });
});

function seedRawMemories(dbPath: string, count: number): void {
  const raw = new Database(dbPath);
  try {
    raw.loadExtension(getLoadablePath());
    raw.exec('BEGIN');
    const insertMessage = raw.prepare(
      'INSERT INTO LlmChatMessage (id, userId, serverId, content, messageText, isBot, embeddingModel, discordMessageId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (let i = 1; i <= count; i++) {
      insertMessage.run(i, 'user-1', 'server-a', `{"id":${i}}`, `m${i}`, 0, 'model', `dm-${i}`, '2025-01-01T00:00:00.000Z');
      raw.prepare(`INSERT INTO LlmChatMessage_vec_4 (rowid, embedding) VALUES (${i}, ?)`).run(JSON.stringify([1, 0, 0, 0]));
    }
    raw.exec('COMMIT');
  } finally {
    raw.close();
  }
}