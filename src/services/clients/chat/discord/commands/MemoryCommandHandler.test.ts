import { describe, expect, it, jest } from '@jest/globals';
import { Client as DiscordClient, GuildTextBasedChannel, Message as DiscordMessage } from 'discord.js';

import { createMockLogger, createMockServiceContainer } from '../../../../../test-utils/mockBotServiceContainer.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { IMemoryService } from '../../../llm/services/IMemoryService.js';
import { MemoryCommandHandler } from './MemoryCommandHandler.js';

const USER_ID = 'user-1';
const BOT_ID = 'bot-1';
const LATEST_MEMORY_TIMESTAMP = '2025-12-01T10:00:00.000Z';
const LATEST_MEMORY_TS = Date.parse(LATEST_MEMORY_TIMESTAMP);
const TOTAL_MESSAGES = 250;

interface FetchOptions {
  before?: string;
  after?: string;
  limit?: number;
}

function createFakeMessage(index: number): DiscordMessage {
  const paddedId = String(index).padStart(4, '0');
  return {
    id: paddedId,
    createdTimestamp: LATEST_MEMORY_TS + index,
    content: `message ${index}`,
    author: { id: USER_ID, bot: false },
  } as unknown as DiscordMessage;
}

function createChannelWithMessages(messages: DiscordMessage[]): { channel: GuildTextBasedChannel; fetch: jest.Mock } {
  const fetch = jest.fn((options: FetchOptions): Promise<Map<string, DiscordMessage>> => {
    const limit = options.limit ?? 50;
    let candidates = messages;
    const beforeId = options.before;
    if (beforeId !== undefined) {
      candidates = messages.filter((m) => m.id < beforeId);
    } else {
      const afterId = options.after;
      if (afterId !== undefined) {
        candidates = messages.filter((m) => m.id > afterId);
      }
    }
    const page = candidates.slice(-limit);
    return Promise.resolve(new Map(page.map((m) => [m.id, m])));
  });

  const channel = {
    id: 'channel-1',
    name: 'general',
    isTextBased: () => true,
    isVoiceBased: () => false,
    viewable: true,
    messages: { fetch },
  } as unknown as GuildTextBasedChannel;

  return { channel, fetch };
}

function createClientWithChannel(channel: GuildTextBasedChannel): DiscordClient {
  const guild = { channels: { cache: new Map([[channel.id, channel]]) } };
  return {
    user: { id: BOT_ID },
    guilds: { cache: new Map([['guild-1', guild]]) },
  } as unknown as DiscordClient;
}

interface TestHarness {
  readonly services: IBotServiceContainer;
  readonly create: jest.Mock;
}

function createTestHarness(options: {
  incompleteBackfillUserIds: string[];
  consentingUserIds: string[];
}): TestHarness {
  const memoryService = {
    hasConsent: jest.fn(() => Promise.resolve(false)),
    setConsent: jest.fn(() => Promise.resolve()),
    isBackfillComplete: jest.fn(() => Promise.resolve(false)),
    markBackfillComplete: jest.fn(() => Promise.resolve()),
    getIncompleteBackfillUserIds: jest.fn(() => Promise.resolve(options.incompleteBackfillUserIds)),
    getAllConsentingUserIds: jest.fn(() => Promise.resolve(options.consentingUserIds)),
    getLatestMemoryTimestamp: jest.fn(() => Promise.resolve(LATEST_MEMORY_TIMESTAMP)),
  } as unknown as IMemoryService;

  const featureService = {
    hasFeature: jest.fn((feature: SupportedFeature): boolean => feature === SupportedFeature.LongTermMemory),
  } as unknown as IFeatureService;

  const create = jest.fn((message: DiscordMessage) => ({ id: message.id }));

  const taskQueue = {
    add: jest.fn((task: { onSuccess?: () => void }): void => {
      task.onSuccess?.();
    }),
  } as unknown as ITaskQueue;

  const services = {
    ...createMockServiceContainer(),
    featureService,
    taskQueue,
    getMemoryService: (): IMemoryService => memoryService,
    getLlmChatMessageFactory: () => ({ create }),
    getEmbedTask: jest.fn(() => ({ status: 0 })),
    getLogger: () => createMockLogger(),
  } as unknown as IBotServiceContainer;

  return { services, create };
}

describe('MemoryCommandHandler', () => {
  it('backfills every storable message in a channel with more than one page of history', async () => {
    const messages = Array.from({ length: TOTAL_MESSAGES }, (_, i) => createFakeMessage(i + 1));
    const { channel } = createChannelWithMessages(messages);
    const { services, create } = createTestHarness({ incompleteBackfillUserIds: [USER_ID], consentingUserIds: [] });
    const client = createClientWithChannel(channel);

    const handler = new MemoryCommandHandler(services);
    await handler.resumeBackfills(client);

    const storedMessageIds = create.mock.calls.map((args) => messageOf(args[0]));
    expect(storedMessageIds).toHaveLength(TOTAL_MESSAGES);
    expect(new Set(storedMessageIds).size).toBe(TOTAL_MESSAGES);
  });

  it('catches up every storable message newer than the latest stored memory, even beyond one page', async () => {
    const messages = Array.from({ length: TOTAL_MESSAGES }, (_, i) => createFakeMessage(i + 1));
    const { channel } = createChannelWithMessages(messages);
    const { services, create } = createTestHarness({ incompleteBackfillUserIds: [], consentingUserIds: [USER_ID] });
    const client = createClientWithChannel(channel);

    const handler = new MemoryCommandHandler(services);
    await handler.resumeBackfills(client);

    const storedMessageIds = create.mock.calls.map((args) => messageOf(args[0]));
    expect(storedMessageIds).toHaveLength(TOTAL_MESSAGES);
    expect(new Set(storedMessageIds).size).toBe(TOTAL_MESSAGES);
  });
});

function messageOf(llmChatMessage: { id?: string }): string {
  return llmChatMessage.id ?? '';
}