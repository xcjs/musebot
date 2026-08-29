import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Client as DiscordClient, Message as DiscordMessage } from 'discord.js';

import { createMockLogger, createMockServiceContainer, MockContainer } from '../../../../test-utils/mockBotServiceContainer.js';
import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../features/IFeatureService.js';
import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { IContextMessageFactory } from '../../llm/services/IContextMessageFactory.js';
import { IContextService } from '../../llm/services/IContextService.js';
import { IMemoryService } from '../../llm/services/IMemoryService.js';
import { IReplyService } from '../IReplyService.js';
import { GenerativeChatClient } from './GenerativeChatClient.js';

type MessageHandler = (message: DiscordMessage) => Promise<void>;

interface Harness {
  readonly client: GenerativeChatClient;
  readonly services: IBotServiceContainer;
  readonly taskQueue: { add: jest.Mock };
  readonly getEmbedTask: jest.Mock;
  readonly emitMessageCreate: (message: DiscordMessage) => Promise<void>;
}

function createMessage(overrides: Partial<Record<string, unknown>> = {}): DiscordMessage {
  return {
    author: { id: 'user-1', username: 'tester', displayName: 'Tester', bot: false },
    content: 'hello there',
    guild: { id: 'guild-1' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel: { id: 'channel-1' },
    system: false,
    attachments: new Map(),
    ...overrides,
  } as unknown as DiscordMessage;
}

function createHarness(services: IBotServiceContainer): Harness {
  const listeners = new Map<string, MessageHandler>();
  const discordClient = {
    on: jest.fn((event: string, handler: MessageHandler): void => {
      listeners.set(event, handler);
    }),
    once: jest.fn(),
  } as unknown as DiscordClient;

  const container = services as MockContainer;
  const original = container.discordClient;
  (container as { discordClient: DiscordClient }).discordClient = discordClient;
  void original;

  const client = new GenerativeChatClient(services);
  (container as { discordClient: unknown }).discordClient = original;

  const taskQueue = (services as unknown as { taskQueue: { add: jest.Mock } }).taskQueue;
  const getEmbedTask = (services as unknown as { getEmbedTask: jest.Mock }).getEmbedTask;

  return {
    client,
    services,
    taskQueue,
    getEmbedTask,
    emitMessageCreate: async (message: DiscordMessage): Promise<void> => {
      const handler = listeners.get('messageCreate');
      expect(handler).toBeDefined();
      await handler?.(message);
    },
  };
}

describe('GenerativeChatClient passive memory storage', () => {
  let memoryService: { isEnabled: boolean };
  let featureService: { hasFeature: jest.Mock };
  let replyService: { shouldReply: jest.Mock };

  function buildServices(discordChannels: string[], disallowed: string[]): IBotServiceContainer {
    memoryService = { isEnabled: true };
    featureService = {
      hasFeature: jest.fn((feature: SupportedFeature): boolean => feature === SupportedFeature.LongTermMemory),
    };
    replyService = { shouldReply: jest.fn((): boolean => false) };

    const base = createMockServiceContainer();
    const configuration = { ...base.configurationService, discordChannels, discordChannelsDisallowed: disallowed };

    const taskQueue = { add: jest.fn() };
    const contextMessageFactory = { fromSystemPrompt: jest.fn(() => ({})) };
    const contextService = { addContext: jest.fn() };

    return {
      ...base,
      configurationService: configuration,
      featureService: featureService as unknown as IFeatureService,
      taskQueue,
      getContextMessageFactory: () => contextMessageFactory as unknown as IContextMessageFactory<DiscordMessage, never>,
      getContextService: () => contextService as unknown as IContextService<DiscordMessage, never>,
      getReplyService: () => replyService as unknown as IReplyService<DiscordMessage, never, never, never>,
      getMemoryService: () => memoryService as unknown as IMemoryService,
      getLlmChatMessageFactory: () => ({ create: jest.fn(() => ({})) }),
      getEmbedTask: jest.fn(() => ({ status: 0 })),
      getLogger: () => createMockLogger(),
    } as unknown as IBotServiceContainer;
  }

  describe('with an allow-list configured', () => {
    let harness: Harness;

    beforeEach(() => {
      harness = createHarness(buildServices(['allowed-channel'], []));
    });

    it('stores messages from allowed channels', async () => {
      await harness.emitMessageCreate(createMessage({ channelId: 'allowed-channel', channel: { id: 'allowed-channel' } }));

      expect(harness.taskQueue.add).toHaveBeenCalledTimes(1);
    });

    it('does not store messages from channels outside the allow-list', async () => {
      await harness.emitMessageCreate(createMessage({ channelId: 'other-channel', channel: { id: 'other-channel' } }));

      expect(harness.taskQueue.add).not.toHaveBeenCalled();
    });

    it('does not store direct messages', async () => {
      await harness.emitMessageCreate(createMessage({ guild: null, guildId: null }));

      expect(harness.taskQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('with a disallowed channel configured', () => {
    let harness: Harness;

    beforeEach(() => {
      harness = createHarness(buildServices([], ['blocked-channel']));
    });

    it('does not store messages from disallowed channels', async () => {
      await harness.emitMessageCreate(createMessage({ channelId: 'blocked-channel', channel: { id: 'blocked-channel' } }));

      expect(harness.taskQueue.add).not.toHaveBeenCalled();
    });

    it('stores messages from other channels when no allow-list is configured', async () => {
      await harness.emitMessageCreate(createMessage({ channelId: 'open-channel', channel: { id: 'open-channel' } }));

      expect(harness.taskQueue.add).toHaveBeenCalledTimes(1);
    });
  });
});