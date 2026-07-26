import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ChatInputCommandInteraction, Client as DiscordClient } from 'discord.js';

import type { IConfigurationService } from '../../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import type { IFeatureService } from '../../../../features/IFeatureService.js';
import type { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import type { ILogger } from '../../../../ILogger.js';
import type { IParallelizationStrategy } from '../../../../parallelization/IParallelizationStrategy.js';
import type { ITaskChannelPostProcessor } from '../../../../parallelization/ITaskChannelPostProcessor.js';
import type { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { LlmChatMessage } from '../../../llm/ollama/models/LlmChatMessage.js';
import type { ILlmChatMessageFactory } from '../../../llm/services/ILlmChatMessageFactory.js';
import type { IMemoryService } from '../../../llm/services/IMemoryService.js';
import { MemoryCommandHandler } from './MemoryCommandHandler.js';

const TEST_BOT_ID = 'test-bot-123';

function createMockLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };
}

function createMockFeatureService(ltmEnabled: boolean, visionEnabled: boolean): jest.Mocked<IFeatureService> {
  return {
    hasFeature: jest.fn((feature: SupportedFeature) => {
      if (feature === SupportedFeature.LongTermMemory) return ltmEnabled;
      if (feature === SupportedFeature.Vision) return visionEnabled;
      return false;
    }),
  } as unknown as jest.Mocked<IFeatureService>;
}

function createMockMemoryService(overrides: Partial<IMemoryService> = {}): jest.Mocked<IMemoryService> {
  return {
    isEnabled: true,
    hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
    setConsent: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    removeConsent: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    markBackfillComplete: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getIncompleteBackfillUserIds: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
    getAllConsentingUserIds: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
    getLatestMemoryTimestamp: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
    hasMessage: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
    store: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    retrieve: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    ...overrides,
  } as unknown as jest.Mocked<IMemoryService>;
}

function createMockConfig(overrides: Partial<IConfigurationService> = {}): IConfigurationService {
  return {
    discordChannelsDisallowed: [],
    botId: TEST_BOT_ID,
    maxTaskAttempts: 3,
    ...overrides,
  } as unknown as IConfigurationService;
}

interface MockMessage {
  id: string;
  content: string;
  author: { id: string; bot: boolean; username: string };
  createdTimestamp: number;
  attachments: Map<number, unknown>;
  url: string;
}

function createMockMessage(options: {
  id?: string;
  content?: string;
  authorId?: string;
  isBot?: boolean;
  createdTimestamp?: number;
} = {}): MockMessage {
  return {
    id: options.id ?? `msg-${Math.random().toString(36).slice(2)}`,
    content: options.content ?? 'hello world',
    author: {
      id: options.authorId ?? 'user-1',
      bot: options.isBot ?? false,
      username: options.authorId ?? 'user-1',
    },
    createdTimestamp: options.createdTimestamp ?? Date.now(),
    attachments: new Map(),
    url: `https://discord.com/channels/server/channel/${options.id ?? 'msg'}`,
  };
}

type FetchOpts = { limit?: number; before?: string; after?: string };
type MockFetch = jest.MockedFunction<(opts: FetchOpts) => Promise<Map<string, MockMessage>>>;

interface MockChannel {
  id: string;
  name: string;
  viewable: boolean;
  isTextBased: () => boolean;
  isVoiceBased: () => boolean;
  messages: { fetch: MockFetch; size: number };
}

function buildFetchImpl(msgs: MockMessage[], empty: boolean): MockFetch {
  return jest.fn((opts: { limit?: number; before?: string; after?: string }) => {
    if (empty) return Promise.resolve(new Map<string, MockMessage>());
    const limit = opts.limit ?? 100;
    let result: MockMessage[];

    if (opts.before !== undefined) {
      const beforeIdx = msgs.findIndex(m => m.id === opts.before);
      if (beforeIdx === -1) {
        result = msgs.slice(0, limit);
      } else {
        result = msgs.slice(Math.max(0, beforeIdx - limit), beforeIdx);
      }
    } else if (opts.after !== undefined) {
      const afterIdx = msgs.findIndex(m => m.id === opts.after);
      if (afterIdx === -1) {
        result = [];
      } else {
        result = msgs.slice(afterIdx + 1, afterIdx + 1 + limit);
      }
    } else {
      result = msgs.slice(0, limit);
    }

    return Promise.resolve(new Map<string, MockMessage>(result.map(m => [m.id, m])));
  });
}

function createMockChannel(options: {
  id?: string;
  name?: string;
  viewable?: boolean;
  messages?: MockMessage[];
  empty?: boolean;
} = {}): MockChannel {
  const msgs = options.messages ?? [];
  const empty = options.empty ?? false;
  return {
    id: options.id ?? 'channel-1',
    name: options.name ?? 'general',
    viewable: options.viewable ?? true,
    isTextBased: () => true,
    isVoiceBased: () => false,
    messages: { fetch: buildFetchImpl(msgs, empty), size: 0 },
  };
}

interface MockGuild {
  id: string;
  channels: { cache: Map<string, MockChannel> };
}

function createMockGuild(options: {
  channels?: MockChannel[];
} = {}): MockGuild {
  return {
    id: 'guild-1',
    channels: {
      cache: new Map((options.channels ?? []).map((c, i) => [c.id ?? `channel-${i}`, c])),
    },
  };
}

interface MockClient {
  user: { id: string } | null;
  guilds: { cache: Map<string, MockGuild> };
}

function createMockClient(options: {
  guilds?: MockGuild[];
  userId?: string;
} = {}): MockClient {
  const userId = options.userId ?? TEST_BOT_ID;
  return {
    user: { id: userId },
    guilds: {
      cache: new Map((options.guilds ?? []).map((g, i) => [g.id ?? `guild-${i}`, g])),
    },
  };
}

interface MockInteraction {
  user: { id: string };
  options: { getSubcommand: jest.Mock };
  editReply: jest.Mock;
  client: MockClient;
}

function createMockInteraction(options: {
  subcommand?: string;
  userId?: string;
  client?: MockClient;
} = {}): MockInteraction {
  return {
    user: { id: options.userId ?? 'user-1' },
    options: {
      getSubcommand: jest.fn(() => options.subcommand ?? 'remember'),
    },
    editReply: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    client: options.client ?? createMockClient(),
  };
}

class MockEmbedTask extends BaseTask<void> {
  readonly #success: boolean;
  readonly #storeFn: (() => Promise<void>) | null;
  #onSuccess: (() => void) | undefined;
  #onFailure: ((error: Error) => void) | undefined;

  constructor(services: IBotServiceContainer, success: boolean, storeFn: (() => Promise<void>) | null = null) {
    super(services);
    this.#success = success;
    this.#storeFn = storeFn;
  }

  override get taskChannel(): string {
    return 'test-channel';
  }

  override set onSuccess(callback: (() => void) | undefined) {
    this.#onSuccess = callback;
  }

  override set onFailure(callback: ((error: Error) => void) | undefined) {
    this.#onFailure = callback;
  }

  override async process(): Promise<void> {
    if (this.#success) {
      if (this.#storeFn) {
        await this.#storeFn();
      }
      this.#onSuccess?.();
    } else {
      this.lastError = new Error('mock embed failure');
      this.#onFailure?.(this.lastError);
    }
  }

  override async postProcess(): Promise<void> {
    await Promise.resolve();
  }
}

function createMockServices(options: {
  ltmEnabled?: boolean;
  visionEnabled?: boolean;
  memoryService?: jest.Mocked<IMemoryService>;
  disallowedChannels?: string[];
  embedSucceeds?: boolean;
} = {}): IBotServiceContainer {
  const loggerInstance = createMockLogger();
  const ltmEnabled = options.ltmEnabled ?? true;
  const visionEnabled = options.visionEnabled ?? false;
  const embedSucceeds = options.embedSucceeds ?? true;
  const memoryService = options.memoryService ?? createMockMemoryService();
  const config = createMockConfig({
    discordChannelsDisallowed: options.disallowedChannels ?? [],
    botId: TEST_BOT_ID,
    maxTaskAttempts: 3,
  });
  const featureService = createMockFeatureService(ltmEnabled, visionEnabled);

  const taskQueue: jest.Mocked<ITaskQueue> = {
    add: jest.fn((task: BaseTask<unknown>) => {
      void task.process().then(() => task.postProcess());
    }),
  } as unknown as jest.Mocked<ITaskQueue>;

  const parallelizationStrategy: IParallelizationStrategy = {
    getTaskChannel: jest.fn(() => 'test-channel'),
  } as unknown as IParallelizationStrategy;

  const llmChatMessageFactory: jest.Mocked<ILlmChatMessageFactory<MockMessage>> = {
    create: jest.fn((message: MockMessage): LlmChatMessage => ({
      messageId: message.id ?? 'msg-unknown',
      username: message.author?.username ?? 'user',
      displayName: message.author?.username ?? 'user',
      userId: message.author?.id ?? 'unknown',
      isBot: message.author?.bot ?? false,
      message: message.content ?? '',
      datetime: new Date(message.createdTimestamp ?? Date.now()).toISOString(),
      roles: [],
      channel: { id: 'channel-1', name: 'general', topic: null },
      thread: null,
      server: { id: 'server-1', name: 'Test Server' },
      mentions: { users: [], roles: [], everyone: false },
      attachments: [],
    })),
    createFromLlmResponse: jest.fn(),
  } as unknown as jest.Mocked<ILlmChatMessageFactory<MockMessage>>;

  const servicesRef: { services: IBotServiceContainer } = { services: null as unknown as IBotServiceContainer };

  servicesRef.services = {
    configurationService: config,
    featureService,
    taskQueue,
    typingService: null as never,
    discordClient: null as never,
    generativeChatClient: null as never,
    helpService: null as never,
    workflowService: null as never,
    parallelizationStrategy,
    webContentService: null as never,
    getWorkflowMutator: null as never,
    contentTypeService: null as never,
    comfyUiClient: null as never,
    comfyUiReplyService: null as never,
    ollamaClient: null as never,
    ollamaReplyService: null as never,
    ollamaStreamingReplyService: null as never,
    actionRowBuilderFactory: null as never,
    getLogger: jest.fn(() => loggerInstance),
    getChatMessageFilters: () => [],
    getInputChatMessageFilters: () => [],
    getChatMessageFactory: () => null as never,
    getLlmChatMessageFactory: () => llmChatMessageFactory,
    getMemoryService: () => memoryService,
    getContextMessageFactory: () => null as never,
    getContextService: () => null as never,
    getLlmGenerateTask: () => null as never,
    getLlmGenerateStructuredTask: () => null as never,
    getEmbedTask: (llmChatMessage: LlmChatMessage, ownerUserId?: string) =>
      new MockEmbedTask(servicesRef.services, embedSucceeds, async () => {
        await memoryService.store(llmChatMessage, ownerUserId);
      }),
    getEmojiReactionTask: () => null as never,
    getMessageTask: () => null as never,
    getInteractionTask: () => null as never,
    getAttachmentTask: () => null as never,
    getCustomInteractionTask: () => null as never,
    getTaskChannelPostProcessor: (() => null as never) as unknown as () => ITaskChannelPostProcessor,
  } as unknown as IBotServiceContainer;

  return servicesRef.services;
}

describe('MemoryCommandHandler', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handle()', () => {
    it('should reply that LTM is not enabled when feature is disabled', async () => {
      const services = createMockServices({ ltmEnabled: false });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember' });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(interaction.editReply).toHaveBeenCalledWith('Long-term memory is not enabled on this bot.');
    });

    it('should route remember subcommand to #handleRemember', async () => {
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember' });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(memoryService.hasConsent).toHaveBeenCalledWith('user-1');
      expect(interaction.editReply).toHaveBeenCalledWith(
        'You are already opted in to long-term memory. Your messages will continue to be remembered.',
      );
    });

    it('should route forget subcommand to #handleForget', async () => {
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'forget' });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(memoryService.removeConsent).toHaveBeenCalledWith('user-1');
      expect(interaction.editReply).toHaveBeenCalledWith(
        'You have opted out of long-term memory. All your stored memories have been deleted.',
      );
    });

    it('should reply unknown command for invalid subcommand', async () => {
      const services = createMockServices();
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'invalid' });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(interaction.editReply).toHaveBeenCalledWith('Unknown memory command.');
    });
  });

  describe('#handleRemember', () => {
    it('should set consent and backfill when user has not consented', async () => {
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
      });
      const client = createMockClient({
        guilds: [createMockGuild({ channels: [createMockChannel({ empty: true })] })],
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember', client });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(memoryService.setConsent).toHaveBeenCalledWith('user-1');
      expect(memoryService.markBackfillComplete).toHaveBeenCalledWith('user-1');
      expect(interaction.editReply).toHaveBeenCalledTimes(2);
    });

    it('should resume backfill when already consented but backfill incomplete', async () => {
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
      });
      const client = createMockClient({
        guilds: [createMockGuild({ channels: [createMockChannel({ empty: true })] })],
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember', client });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(memoryService.markBackfillComplete).toHaveBeenCalledWith('user-1');
      expect(interaction.editReply).toHaveBeenCalledTimes(2);
      expect(interaction.editReply).toHaveBeenNthCalledWith(
        1,
        'You are already opted in to long-term memory. Resuming backfill of messages from all channels...',
      );
    });

    it('should skip backfill when already consented and backfill complete', async () => {
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember' });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(interaction.editReply).toHaveBeenCalledTimes(1);
      expect(interaction.editReply).toHaveBeenCalledWith(
        'You are already opted in to long-term memory. Your messages will continue to be remembered.',
      );
    });
  });

  describe('#handleForget', () => {
    it('should reply nothing to forget when user had no consent', async () => {
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'forget' });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(memoryService.removeConsent).toHaveBeenCalledWith('user-1');
      expect(interaction.editReply).toHaveBeenCalledWith(
        'You were not opted in to long-term memory. Nothing to forget.',
      );
    });

    it('should reply opted out when user had consent', async () => {
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'forget' });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(memoryService.removeConsent).toHaveBeenCalledWith('user-1');
      expect(interaction.editReply).toHaveBeenCalledWith(
        'You have opted out of long-term memory. All your stored memories have been deleted.',
      );
    });
  });

  describe('#isStorable', () => {
    it('should store messages with text content', async () => {
      const client = createMockClient({
        guilds: [
          createMockGuild({
            channels: [
              createMockChannel({
                messages: [createMockMessage({ content: 'hello', authorId: 'user-1' })],
              }),
            ],
          }),
        ],
      });
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember', client });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(memoryService.store).toHaveBeenCalledTimes(1);
    });

    it('should not store messages with empty content and no images', async () => {
      const client = createMockClient({
        guilds: [
          createMockGuild({
            channels: [
              createMockChannel({
                messages: [createMockMessage({ content: '   ', authorId: 'user-1' })],
              }),
            ],
          }),
        ],
      });
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember', client });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(memoryService.store).not.toHaveBeenCalled();
    });

    it('should not store messages from other users', async () => {
      const client = createMockClient({
        guilds: [
          createMockGuild({
            channels: [
              createMockChannel({
                messages: [createMockMessage({ content: 'hello', authorId: 'other-user' })],
              }),
            ],
          }),
        ],
      });
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember', client });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(memoryService.store).not.toHaveBeenCalled();
    });

    it('should not store messages from other bots', async () => {
      const client = createMockClient({
        guilds: [
          createMockGuild({
            channels: [
              createMockChannel({
                messages: [
                  createMockMessage({ content: 'hello', authorId: 'other-bot', isBot: true }),
                ],
              }),
            ],
          }),
        ],
      });
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember', client });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(memoryService.store).not.toHaveBeenCalled();
    });

    it('should store bot messages from the bot itself (owner is the user)', async () => {
      const client = createMockClient({
        guilds: [
          createMockGuild({
            channels: [
              createMockChannel({
                messages: [
                  createMockMessage({ content: 'response', authorId: TEST_BOT_ID, isBot: true }),
                ],
              }),
            ],
          }),
        ],
      });
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember', client });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(memoryService.store).toHaveBeenCalledTimes(1);
    });
  });

  describe('#backfillChannel pagination', () => {
    it('should use oldest message id as beforeId cursor (newest-first sort)', async () => {
      const page1: MockMessage[] = [];
      const page2: MockMessage[] = [];
      for (let i = 0; i < 100; i++) {
        page1.push(
          createMockMessage({ id: `p1-${i}`, content: `msg-1-${i}`, authorId: 'user-1', createdTimestamp: 1000 - i }),
        );
      }
      for (let i = 0; i < 100; i++) {
        page2.push(
          createMockMessage({ id: `p2-${i}`, content: `msg-2-${i}`, authorId: 'user-1', createdTimestamp: 900 - i }),
        );
      }

      const channel = createMockChannel({ messages: [...page1, ...page2] });
      let fetchCalls = 0;
      channel.messages.fetch.mockImplementation(() => {
        fetchCalls++;
        if (fetchCalls === 1) return Promise.resolve(new Map(page1.map(m => [m.id, m])));
        if (fetchCalls === 2) return Promise.resolve(new Map(page2.map(m => [m.id, m])));
        return Promise.resolve(new Map<string, MockMessage>());
      });

      const client = createMockClient({
        guilds: [createMockGuild({ channels: [channel] })],
      });
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember', client });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(fetchCalls).toBe(3);
      expect(channel.messages.fetch.mock.calls[0][0]).toEqual({ limit: 100, before: undefined });
      expect(channel.messages.fetch.mock.calls[1][0].before).toBe(page1[page1.length - 1].id);
      expect(channel.messages.fetch.mock.calls[2][0].before).toBe(page2[page2.length - 1].id);
      expect(memoryService.store).toHaveBeenCalledTimes(200);
    });

    it('should break when messages.size < FETCH_PAGE_SIZE', async () => {
      const smallPage = [
        createMockMessage({ id: '100', content: 'only', authorId: 'user-1', createdTimestamp: 10 }),
      ];

      const channel = createMockChannel({ messages: smallPage });
      channel.messages.fetch.mockImplementation(() => {
        return Promise.resolve(new Map(smallPage.map(m => [m.id, m])));
      });

      const client = createMockClient({
        guilds: [createMockGuild({ channels: [channel] })],
      });
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember', client });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(channel.messages.fetch).toHaveBeenCalledTimes(1);
      expect(memoryService.store).toHaveBeenCalledTimes(1);
    });

    it('should break when channel is empty', async () => {
      const channel = createMockChannel({ empty: true });
      const client = createMockClient({
        guilds: [createMockGuild({ channels: [channel] })],
      });
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember', client });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(channel.messages.fetch).toHaveBeenCalledTimes(1);
      expect(memoryService.store).not.toHaveBeenCalled();
    });
  });

  describe('#catchUpChannel', () => {
    it('should use newest message id as afterId cursor (ascending sort)', async () => {
      const page1: MockMessage[] = [];
      const page2: MockMessage[] = [];
      for (let i = 0; i < 100; i++) {
        page1.push(
          createMockMessage({ id: `c1-${i}`, content: `msg-1-${i}`, authorId: 'user-1', createdTimestamp: 100 + i }),
        );
      }
      for (let i = 0; i < 100; i++) {
        page2.push(
          createMockMessage({ id: `c2-${i}`, content: `msg-2-${i}`, authorId: 'user-1', createdTimestamp: 200 + i }),
        );
      }

      const channel = createMockChannel({ messages: [...page1, ...page2] });
      let fetchCalls = 0;
      channel.messages.fetch.mockImplementation(() => {
        fetchCalls++;
        if (fetchCalls === 1) return Promise.resolve(new Map(page1.map(m => [m.id, m])));
        if (fetchCalls === 2) return Promise.resolve(new Map(page2.map(m => [m.id, m])));
        return Promise.resolve(new Map<string, MockMessage>());
      });

      const client = createMockClient({
        guilds: [createMockGuild({ channels: [channel] })],
        userId: TEST_BOT_ID,
      });
      const memoryService = createMockMemoryService({
        getAllConsentingUserIds: jest.fn<() => Promise<string[]>>().mockResolvedValue(['user-1']),
        getLatestMemoryTimestamp: jest.fn<() => Promise<string | null>>().mockResolvedValue(new Date(50).toISOString()),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);

      await handler.resumeBackfills(client as unknown as DiscordClient);

      expect(fetchCalls).toBe(3);
      expect(channel.messages.fetch.mock.calls[0][0]).toEqual({ limit: 100, after: undefined });
      expect(channel.messages.fetch.mock.calls[1][0].after).toBe(page1[page1.length - 1].id);
      expect(channel.messages.fetch.mock.calls[2][0].after).toBe(page2[page2.length - 1].id);
      expect(memoryService.store).toHaveBeenCalledTimes(200);
    });

    it('should filter messages older than afterDate', async () => {
      const oldMsg = createMockMessage({ id: '50', content: 'old', authorId: 'user-1', createdTimestamp: 25 });
      const newMsg = createMockMessage({ id: '100', content: 'new', authorId: 'user-1', createdTimestamp: 200 });

      const channel = createMockChannel({ messages: [oldMsg, newMsg] });
      channel.messages.fetch.mockImplementation(() => {
        return Promise.resolve(
          new Map([
            [oldMsg.id, oldMsg],
            [newMsg.id, newMsg],
          ]),
        );
      });

      const client = createMockClient({
        guilds: [createMockGuild({ channels: [channel] })],
        userId: TEST_BOT_ID,
      });
      const memoryService = createMockMemoryService({
        getAllConsentingUserIds: jest.fn<() => Promise<string[]>>().mockResolvedValue(['user-1']),
        getLatestMemoryTimestamp: jest.fn<() => Promise<string | null>>().mockResolvedValue(new Date(100).toISOString()),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);

      await handler.resumeBackfills(client as unknown as DiscordClient);

      expect(memoryService.store).toHaveBeenCalledTimes(1);
    });

    it('should skip users with null latestTimestamp', async () => {
      const channel = createMockChannel({ messages: [] });
      channel.messages.fetch.mockImplementation(() => Promise.resolve(new Map<string, MockMessage>()));

      const client = createMockClient({
        guilds: [createMockGuild({ channels: [channel] })],
        userId: TEST_BOT_ID,
      });
      const memoryService = createMockMemoryService({
        getAllConsentingUserIds: jest.fn<() => Promise<string[]>>().mockResolvedValue(['user-1']),
        getLatestMemoryTimestamp: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);

      await handler.resumeBackfills(client as unknown as DiscordClient);

      expect(channel.messages.fetch).not.toHaveBeenCalled();
    });
  });

  describe('resumeBackfills', () => {
    it('should do nothing when LTM feature is disabled', async () => {
      const services = createMockServices({ ltmEnabled: false });
      const handler = new MemoryCommandHandler(services);
      const client = createMockClient();

      await handler.resumeBackfills(client as unknown as DiscordClient);

      const memoryService = services.getMemoryService();
      expect(memoryService.getIncompleteBackfillUserIds).not.toHaveBeenCalled();
    });

    it('should backfill incomplete users then catch up', async () => {
      const channel = createMockChannel({ empty: true });
      const client = createMockClient({
        guilds: [createMockGuild({ channels: [channel] })],
        userId: TEST_BOT_ID,
      });
      const memoryService = createMockMemoryService({
        getIncompleteBackfillUserIds: jest.fn<() => Promise<string[]>>().mockResolvedValue(['user-incomplete']),
        getAllConsentingUserIds: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);

      await handler.resumeBackfills(client as unknown as DiscordClient);

      expect(memoryService.getIncompleteBackfillUserIds).toHaveBeenCalled();
      expect(memoryService.markBackfillComplete).toHaveBeenCalledWith('user-incomplete');
    });

    it('should skip disallowed channels', async () => {
      const disallowedChannel = createMockChannel({ id: 'disallowed-1', messages: [] });
      const allowedChannel = createMockChannel({
        id: 'allowed-1',
        messages: [createMockMessage({ content: 'hi', authorId: 'user-1' })],
      });

      const client = createMockClient({
        guilds: [createMockGuild({ channels: [disallowedChannel, allowedChannel] })],
        userId: TEST_BOT_ID,
      });
      const memoryService = createMockMemoryService({
        getAllConsentingUserIds: jest.fn<() => Promise<string[]>>().mockResolvedValue(['user-1']),
        getLatestMemoryTimestamp: jest.fn<() => Promise<string | null>>().mockResolvedValue(new Date(0).toISOString()),
      });
      const services = createMockServices({ memoryService, disallowedChannels: ['disallowed-1'] });
      const handler = new MemoryCommandHandler(services);

      await handler.resumeBackfills(client as unknown as DiscordClient);

      expect(disallowedChannel.messages.fetch).not.toHaveBeenCalled();
      expect(allowedChannel.messages.fetch).toHaveBeenCalled();
    });

    it('should skip non-viewable channels', async () => {
      const nonViewableChannel = createMockChannel({ id: 'hidden-1', viewable: false, messages: [] });
      const viewableChannel = createMockChannel({
        id: 'visible-1',
        messages: [createMockMessage({ content: 'hi', authorId: 'user-1' })],
      });

      const client = createMockClient({
        guilds: [createMockGuild({ channels: [nonViewableChannel, viewableChannel] })],
        userId: TEST_BOT_ID,
      });
      const memoryService = createMockMemoryService({
        getAllConsentingUserIds: jest.fn<() => Promise<string[]>>().mockResolvedValue(['user-1']),
        getLatestMemoryTimestamp: jest.fn<() => Promise<string | null>>().mockResolvedValue(new Date(0).toISOString()),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);

      await handler.resumeBackfills(client as unknown as DiscordClient);

      expect(nonViewableChannel.messages.fetch).not.toHaveBeenCalled();
      expect(viewableChannel.messages.fetch).toHaveBeenCalled();
    });

    it('should return early when client.user is null', async () => {
      const services = createMockServices();
      const handler = new MemoryCommandHandler(services);
      const client: MockClient = { user: null, guilds: { cache: new Map() } };

      await handler.resumeBackfills(client as unknown as DiscordClient);

      const memoryService = services.getMemoryService();
      expect(memoryService.getAllConsentingUserIds).not.toHaveBeenCalled();
    });

    it('should return early when no consenting users', async () => {
      const channel = createMockChannel({ messages: [] });
      const client = createMockClient({
        guilds: [createMockGuild({ channels: [channel] })],
        userId: TEST_BOT_ID,
      });
      const memoryService = createMockMemoryService({
        getIncompleteBackfillUserIds: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
        getAllConsentingUserIds: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
      });
      const services = createMockServices({ memoryService });
      const handler = new MemoryCommandHandler(services);

      await handler.resumeBackfills(client as unknown as DiscordClient);

      expect(channel.messages.fetch).not.toHaveBeenCalled();
    });
  });

  describe('embed task failures', () => {
    it('should not count failed embed tasks', async () => {
      const client = createMockClient({
        guilds: [
          createMockGuild({
            channels: [
              createMockChannel({
                messages: [createMockMessage({ content: 'hello', authorId: 'user-1' })],
              }),
            ],
          }),
        ],
      });
      const memoryService = createMockMemoryService({
        hasConsent: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        isBackfillComplete: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
      });
      const services = createMockServices({ memoryService, embedSucceeds: false });
      const handler = new MemoryCommandHandler(services);
      const interaction = createMockInteraction({ subcommand: 'remember', client });

      await handler.handle(interaction as unknown as ChatInputCommandInteraction);

      expect(memoryService.store).not.toHaveBeenCalled();
    });
  });
});