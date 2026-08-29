import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createMockLogger } from '../../../../test-utils/mockBotServiceContainer.js';
import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { LlmChatMessage } from '../ollama/models/LlmChatMessage.js';
import { MemoryDatabase } from './MemoryDatabase.js';
import { MemoryService } from './MemoryService.js';

const EMBEDDING = [1, 0.2, 0.3, 0.4];

function createLlmChatMessage(overrides: Partial<LlmChatMessage> = {}): LlmChatMessage {
  return {
    messageId: 'dm-1',
    username: 'tester',
    displayName: 'Tester',
    userId: 'user-1',
    isBot: false,
    message: 'hello world',
    datetime: new Date().toISOString(),
    roles: [],
    channel: { id: 'channel-1', name: 'general', topic: null },
    thread: null,
    server: { id: 'server-1', name: 'Test Server' },
    mentions: [],
    attachments: [],
    ...overrides,
  } as LlmChatMessage;
}

describe('MemoryService', () => {
  let dbDir: string;
  let originalCwd: string;
  let ollamaClient: { embed: jest.Mock; embedBatch: jest.Mock };

  function buildServices(embeddingModel: string): IBotServiceContainer {
    ollamaClient = {
      embed: jest.fn((): Promise<number[]> => Promise.resolve(EMBEDDING)),
      embedBatch: jest.fn((inputs: string[]): Promise<number[][]> => Promise.resolve(inputs.map(() => EMBEDDING))),
    };

    return {
      configurationService: {
        ollamaEmbeddingModel: embeddingModel,
        ollamaTopK: 5,
        botId: 'bot-1',
      },
      featureService: {
        hasFeature: jest.fn((feature: SupportedFeature): boolean => feature === SupportedFeature.LongTermMemory),
      },
      ollamaClient,
      getLogger: (): ReturnType<typeof createMockLogger> => createMockLogger(),
    } as unknown as IBotServiceContainer;
  }

  beforeEach(() => {
    dbDir = mkdtempSync(join(tmpdir(), 'musebot-memory-service-test-'));
    originalCwd = process.cwd();
    process.chdir(dbDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    try {
      rmSync(dbDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // A service instance may still hold the database file open; ignore.
    }
  });

  it('migrates memories stored under a previous non-empty embedding model to the current one', async () => {
    const seedDatabase = new MemoryDatabase(
      join('workflows', 'bot-1', 'txt2txt', 'memory.db'), 4, createMockLogger());
    const message = createLlmChatMessage();
    seedDatabase.storeMemory(
      JSON.stringify(message), message.message, 'user-1', 'server-1', false, 'model-a', 'dm-1', EMBEDDING);
    seedDatabase.close();

    const service = new MemoryService(buildServices('model-b'));

    const result = await service.retrieve(createLlmChatMessage({ messageId: 'dm-query' }));

    expect(result).toHaveLength(1);
    expect(ollamaClient.embedBatch).toHaveBeenCalledWith([expect.stringContaining('"messageId":"dm-1"')]);
  });

  it('embeds the full serialized LlmChatMessage JSON instead of only the message text', async () => {
    const service = new MemoryService(buildServices('model-a'));
    await service.setConsent('user-1');

    const message = createLlmChatMessage();
    await service.store(message);

    const embedInputs = ollamaClient.embed.mock.calls.map((args: unknown[]) => args[0] as string)
      .filter((input: string) => input !== 'dimension probe');
    expect(embedInputs).toHaveLength(1);

    expect(JSON.parse(embedInputs[0])).toEqual(message);
  });

  it('stores the message datetime rather than the insertion time as createdAt', async () => {
    const service = new MemoryService(buildServices('model-a'));
    await service.setConsent('user-1');

    const message = createLlmChatMessage({ datetime: '2025-03-04T09:26:00.000Z' });
    await service.store(message);

    const latest = await service.getLatestMemoryTimestamp('user-1');
    expect(latest).toBe('2025-03-04T09:26:00.000Z');
  });

  it('re-embeds rows whose embeddings came from raw message text and repairs their createdAt', async () => {
    const seedMessage = createLlmChatMessage({ messageId: 'dm-legacy', datetime: '2025-05-05T05:05:00.000Z' });
    const seedDatabase = new MemoryDatabase(
      join('workflows', 'bot-1', 'txt2txt', 'memory.db'), 4, createMockLogger());
    const rowid = seedDatabase.storeMemory(
      JSON.stringify(seedMessage), seedMessage.message, 'user-1', 'server-1', false, 'model-a', 'dm-legacy', EMBEDDING,
      { embeddingSource: 'message', createdAt: '1999-01-01T00:00:00.000Z' });
    expect(rowid).not.toBeNull();
    seedDatabase.close();

    const service = new MemoryService(buildServices('model-a'));
    await service.waitForInitialMigration();

    const raw = new MemoryDatabase(join('workflows', 'bot-1', 'txt2txt', 'memory.db'), 4, createMockLogger());
    try {
      expect(raw.getMemoryCountByModel('model-a')).toBe(1);
      expect(raw.getMemoriesNeedingReembed('model-a', 0, 10)).toHaveLength(0);
      expect(raw.getLatestMemoryTimestamp('user-1')).toBe('2025-05-05T05:05:00.000Z');
    } finally {
      raw.close();
    }

    expect(ollamaClient.embedBatch).toHaveBeenCalledWith([JSON.stringify(seedMessage)]);
  });

  it('batches embedding requests during migration', async () => {
    const seedDatabase = new MemoryDatabase(
      join('workflows', 'bot-1', 'txt2txt', 'memory.db'), 4, createMockLogger());
    for (let i = 0; i < 5; i++) {
      const message = createLlmChatMessage({ messageId: `dm-batch-${i}` });
      seedDatabase.storeMemory(
        JSON.stringify(message), message.message, 'user-1', 'server-1', false, 'model-a', `dm-batch-${i}`, EMBEDDING,
        { embeddingSource: 'message' });
    }
    seedDatabase.close();

    const service = new MemoryService(buildServices('model-a'));
    await service.waitForInitialMigration();
    await serviceProbeForBatchedMigration(ollamaClient);

    const batchCalls = ollamaClient.embedBatch.mock.calls.map((args: unknown[]) => args[0] as string[]);
    expect(batchCalls.length).toBeGreaterThanOrEqual(1);
    expect(batchCalls[0].length).toBe(5);
    expect(ollamaClient.embed.mock.calls.filter((args: unknown[]) => args[0] !== 'dimension probe'))
      .toHaveLength(0);
  });

  it('shares one database promise across concurrent callers', async () => {
    let resolveEmbed: ((value: number[]) => void) | undefined;
    ollamaClient.embed = jest.fn((): Promise<number[]> => new Promise<number[]>((resolve) => {
      resolveEmbed = resolve;
    }));

    const services = buildServices('model-a');
    services.ollamaClient = ollamaClient as never;
    const service = new MemoryService(services);

    const first = service.hasConsent('user-1');
    const second = service.isBackfillComplete('user-1');

    resolveEmbed?.(EMBEDDING);
    await Promise.all([first, second]);

    expect(ollamaClient.embed).toHaveBeenCalledTimes(1);
  });

  it('closes the database on shutdown', async () => {
    const service = new MemoryService(buildServices('model-a'));
    await service.setConsent('user-1');

    await service.closeDatabase();

    const raw = new MemoryDatabase(join('workflows', 'bot-1', 'txt2txt', 'memory.db'), 4, createMockLogger());
    try {
      expect(raw.hasConsent('user-1')).toBe(true);
    } finally {
      raw.close();
    }
  });
});

async function serviceProbeForBatchedMigration(ollamaClient: { embedBatch: jest.Mock }): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (ollamaClient.embedBatch.mock.calls.length > 0) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('embedBatch was never called.');
}