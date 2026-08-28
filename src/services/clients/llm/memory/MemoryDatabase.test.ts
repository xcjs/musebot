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

    expect(() => db.updateMemoryEmbeddingModel(rowid, 'model-b', [1, 0.5])).toThrow();

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