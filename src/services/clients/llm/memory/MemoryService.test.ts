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
  let ollamaClient: { embed: jest.Mock };

  function buildServices(embeddingModel: string): IBotServiceContainer {
    ollamaClient = {
      embed: jest.fn((): Promise<number[]> => Promise.resolve(EMBEDDING)),
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
    expect(ollamaClient.embed).toHaveBeenCalledWith(expect.stringContaining('"messageId":"dm-1"'));
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
});