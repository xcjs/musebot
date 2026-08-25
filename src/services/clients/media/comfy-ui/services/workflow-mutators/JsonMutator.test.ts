import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Attachment, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import type { IBotServiceContainer } from '../../../../../IBotServiceContainer.js';
import type { ILogger } from '../../../../../ILogger.js';
import type { IParallelizationStrategy } from '../../../../../parallelization/IParallelizationStrategy.js';
import type { ITaskChannelPostProcessor } from '../../../../../parallelization/ITaskChannelPostProcessor.js';
import { DiscordConstants } from '../../../../chat/discord/enums/DiscordConstants.js';
import type { IReplyService } from '../../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { JsonMutator } from './JsonMutator.js';

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

type DiscordReplyService = IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction>;

function createMockReplyService(promptWithoutMentions: string): jest.Mocked<DiscordReplyService> {
  return {
    getMessageWithoutBotMentions: jest.fn(() => promptWithoutMentions),
  } as unknown as jest.Mocked<DiscordReplyService>;
}

function createMockServices(replyService: jest.Mocked<DiscordReplyService>): IBotServiceContainer {
  return {
    configurationService: null as never,
    featureService: null as never,
    taskQueue: null as never,
    typingService: null as never,
    discordClient: null as never,
    generativeChatClient: null as never,
    helpService: null as never,
    workflowService: null as never,
    webContentService: null as never,
    parallelizationStrategy: { getTaskChannel: jest.fn(() => 'test') } as unknown as IParallelizationStrategy,
    getLogger: jest.fn(() => createMockLogger()),
    getTaskChannelPostProcessor: (() => null as never) as unknown as () => ITaskChannelPostProcessor,
    getContextMessageFactory: () => null as never,
    getContextService: () => null as never,
    getContextCompressionService: () => null as never,
    getLlmGenerateTask: () => null as never,
    getLlmGenerateStructuredTask: () => null as never,
    getEmojiReactionTask: () => null as never,
    getEmbedTask: () => null as never,
    getMessageTask: () => null as never,
    getInteractionTask: () => null as never,
    getAttachmentTask: () => null as never,
    getCustomInteractionTask: () => null as never,
    getWorkflowMutator: () => null as never,
    getReplyService: (() => replyService) as unknown as IBotServiceContainer['getReplyService'],
    contentTypeService: null as never,
    comfyUiClient: null as never,
    comfyUiReplyService: null as never,
    ollamaClient: null as never,
    ollamaReplyService: null as never,
    ollamaStreamingReplyService: null as never,
    actionRowBuilderFactory: null as never,
    getChatMessageFilters: () => [], getInputChatMessageFilters: () => [],
    getChatMessageFactory: () => null as never, getLlmChatMessageFactory: () => null as never, getMemoryService: () => null as never,
  };
}

function createBaseRenderRequest(overrides: Partial<SerializableRenderRequest> = {}): SerializableRenderRequest {
  const request = new SerializableRenderRequest();
  request.prompt = null;
  request.promptNegative = null;
  request.workflow = 'test-workflow';
  request.seed = 12345;
  request.width = 512;
  request.height = 512;
  request.sampler = 'euler';
  request.scheduler = 'normal';
  request.cfgScale = 7;
  request.steps = 20;
  request.num = 1;
  Object.assign(request, overrides);

  return request;
}

function createMockMessage(): jest.Mocked<Message> {
  return {
    reply: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Message>;
}

describe('JsonMutator', () => {
  let mockReplyService: jest.Mocked<DiscordReplyService>;
  let mockMessage: jest.Mocked<Message>;
  let mutator: JsonMutator;

  beforeEach((): void => {
    mockReplyService = createMockReplyService('');
    mockMessage = createMockMessage();
    mutator = new JsonMutator(createMockServices(mockReplyService));
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('getters', () => {
    it('should return [BotInteraction.JsonMessage] for interactions', (): void => {
      expect(mutator.interactions).toEqual([BotInteraction.JsonMessage]);
    });

    it('should return all txt2 media types for types', (): void => {
      expect(mutator.types).toEqual([
        SupportedFeature.Txt2Audio,
        SupportedFeature.Txt2Img,
        SupportedFeature.Txt2Music,
        SupportedFeature.Txt2Vid
      ]);
    });

    it('should return empty string for contentMessage', (): void => {
      expect(mutator.contentMessage).toBe('');
    });

    it('should return empty array for additionalAttachments', (): void => {
      expect(mutator.additionalAttachments).toEqual([]);
    });
  });

  describe('mutate() — success path', () => {
    it('should parse valid JSON from the prompt and return a mutated request', async (): Promise<void> => {
      const json = JSON.stringify(createBaseRenderRequest({ prompt: 'a cat', workflow: 'json-workflow' }));
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => json);
      mutator = new JsonMutator(createMockServices(mockReplyService));

      const renderRequest = createBaseRenderRequest();
      const result = await mutator.mutate(renderRequest, mockMessage, {} as never);

      expect(result).not.toBeNull();
      expect(result?.prompt).toBe('a cat');
      expect(result?.workflow).toBe('json-workflow');
    });

    it('should ceil fractional height and width', async (): Promise<void> => {
      const json = JSON.stringify(createBaseRenderRequest({ height: 512.7, width: 256.2 }));
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => json);
      mutator = new JsonMutator(createMockServices(mockReplyService));

      const result = await mutator.mutate(createBaseRenderRequest(), mockMessage, {} as never);

      expect(result?.height).toBe(513);
      expect(result?.width).toBe(257);
    });

    it('should leave integer height and width unchanged after ceil', async (): Promise<void> => {
      const json = JSON.stringify(createBaseRenderRequest({ height: 512, width: 256 }));
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => json);
      mutator = new JsonMutator(createMockServices(mockReplyService));

      const result = await mutator.mutate(createBaseRenderRequest(), mockMessage, {} as never);

      expect(result?.height).toBe(512);
      expect(result?.width).toBe(256);
    });

    it('should refresh seed when seed is -1', async (): Promise<void> => {
      const json = JSON.stringify(createBaseRenderRequest({ seed: -1 }));
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => json);
      mutator = new JsonMutator(createMockServices(mockReplyService));

      const result = await mutator.mutate(createBaseRenderRequest(), mockMessage, {} as never);

      expect(result?.seed).not.toBe(-1);
      expect(result?.seed).toBeGreaterThanOrEqual(0);
    });

    it('should not refresh seed when seed is not -1', async (): Promise<void> => {
      const json = JSON.stringify(createBaseRenderRequest({ seed: 999 }));
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => json);
      mutator = new JsonMutator(createMockServices(mockReplyService));

      const result = await mutator.mutate(createBaseRenderRequest(), mockMessage, {} as never);

      expect(result?.seed).toBe(999);
    });

    it('should clamp num to MaxMediaAttachmentsPerMessage - 1 when exceeding', async (): Promise<void> => {
      const json = JSON.stringify(createBaseRenderRequest({ num: 100 }));
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => json);
      mutator = new JsonMutator(createMockServices(mockReplyService));

      const result = await mutator.mutate(createBaseRenderRequest(), mockMessage, {} as never);

      expect(result?.num).toBe(DiscordConstants.MaxMediaAttachmentsPerMessage - 1);
    });

    it('should not clamp num when within the limit', async (): Promise<void> => {
      const json = JSON.stringify(createBaseRenderRequest({ num: 5 }));
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => json);
      mutator = new JsonMutator(createMockServices(mockReplyService));

      const result = await mutator.mutate(createBaseRenderRequest(), mockMessage, {} as never);

      expect(result?.num).toBe(5);
    });

    it('should not clamp num when exactly at the limit', async (): Promise<void> => {
      const limit = DiscordConstants.MaxMediaAttachmentsPerMessage - 1;
      const json = JSON.stringify(createBaseRenderRequest({ num: limit }));
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => json);
      mutator = new JsonMutator(createMockServices(mockReplyService));

      const result = await mutator.mutate(createBaseRenderRequest(), mockMessage, {} as never);

      expect(result?.num).toBe(limit);
    });

    it('should call getMessageWithoutBotMentions with the interaction', async (): Promise<void> => {
      const json = JSON.stringify(createBaseRenderRequest());
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => json);
      mutator = new JsonMutator(createMockServices(mockReplyService));

      await mutator.mutate(createBaseRenderRequest(), mockMessage, {} as never);

      expect(mockReplyService.getMessageWithoutBotMentions).toHaveBeenCalledWith(mockMessage);
    });
  });

  describe('mutate() — failure path', () => {
    it('should reply with an insult and return null when prompt is not valid JSON', async (): Promise<void> => {
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => 'not json at all');
      mutator = new JsonMutator(createMockServices(mockReplyService));

      const result = await mutator.mutate(createBaseRenderRequest(), mockMessage, {} as never);

      expect(result).toBeNull();
      expect(mockMessage.reply).toHaveBeenCalledTimes(1);
      expect(mockMessage.reply).toHaveBeenCalledWith('You call that JSON? My grandmother could knit better JSON.');
    });

    it('should reply with an insult and return null when prompt is empty string', async (): Promise<void> => {
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => '');
      mutator = new JsonMutator(createMockServices(mockReplyService));

      const result = await mutator.mutate(createBaseRenderRequest(), mockMessage, {} as never);

      expect(result).toBeNull();
      expect(mockMessage.reply).toHaveBeenCalledTimes(1);
    });

    it('should reply with an insult and return null when prompt is partial JSON', async (): Promise<void> => {
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => '{ "prompt": "incomplete"');
      mutator = new JsonMutator(createMockServices(mockReplyService));

      const result = await mutator.mutate(createBaseRenderRequest(), mockMessage, {} as never);

      expect(result).toBeNull();
      expect(mockMessage.reply).toHaveBeenCalledTimes(1);
    });

    it('should not call reply when JSON is valid', async (): Promise<void> => {
      const json = JSON.stringify(createBaseRenderRequest());
      mockReplyService.getMessageWithoutBotMentions = jest.fn(() => json);
      mutator = new JsonMutator(createMockServices(mockReplyService));

      await mutator.mutate(createBaseRenderRequest(), mockMessage, {} as never);

      expect(mockMessage.reply).not.toHaveBeenCalled();
    });
  });
});