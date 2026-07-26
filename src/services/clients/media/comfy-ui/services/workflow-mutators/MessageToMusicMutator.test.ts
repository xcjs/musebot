import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GenerateRequest, GenerateResponse } from 'ollama';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import type { IFeatureService } from '../../../../../features/IFeatureService.js';
import type { IBotServiceContainer } from '../../../../../IBotServiceContainer.js';
import type { ILogger } from '../../../../../ILogger.js';
import type { IParallelizationStrategy } from '../../../../../parallelization/IParallelizationStrategy.js';
import type { ITaskChannelPostProcessor } from '../../../../../parallelization/ITaskChannelPostProcessor.js';
import type { ITaskQueue } from '../../../../../tasks/ITaskQueue.js';
import type { BaseTask } from '../../../../../tasks/models/BaseTask.js';
import type { IReplyService } from '../../../../chat/IReplyService.js';
import { BpmConstants } from '../../models/music/BpmConstants.js';
import { KeyScale } from '../../models/music/KeyScale.js';
import { SongPromptMetadata } from '../../models/music/SongPromptMetadataRequestType.js';
import { SongPromptType } from '../../models/music/SongPromptType.js';
import { TimeSignature } from '../../models/music/TimeSignature.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { MessageToMusicMutator } from './MessageToMusicMutator.js';

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

function createMockFeatureService(hasTxt2Txt: boolean): jest.Mocked<IFeatureService> {
  return {
    hasFeature: jest.fn((feature): boolean => feature === 'txt2txt' ? hasTxt2Txt : false),
  } as unknown as jest.Mocked<IFeatureService>;
}

interface MockStructuredTask {
  isChild: boolean;
  onSuccess: (payload: unknown) => void;
  onFailure: (error: Error) => void;
}

class MockStructuredTaskImpl implements MockStructuredTask {
  isChild = false;
  #successPayload: unknown;
  #failureError: Error | null;
  #successFn: (payload: unknown) => void = (): void => { };
  #failureFn: (error: Error) => void = (): void => { };

  constructor(successPayload: unknown, failureError: Error | null = null) {
    this.#successPayload = successPayload;
    this.#failureError = failureError;
  }

  set onSuccess(fn: (payload: unknown) => void) {
    this.#successFn = fn;
    if (this.#failureError === null) {
      queueMicrotask((): void => fn(this.#successPayload));
    }
  }

  get onSuccess(): (payload: unknown) => void {
    return this.#successFn;
  }

  set onFailure(fn: (error: Error) => void) {
    this.#failureFn = fn;
    if (this.#failureError !== null) {
      queueMicrotask((): void => fn(this.#failureError));
    }
  }

  get onFailure(): (error: Error) => void {
    return this.#failureFn;
  }
}

function createMockStructuredTask(successPayload: unknown, failureError: Error | null = null): MockStructuredTask {
  return new MockStructuredTaskImpl(successPayload, failureError);
}

function createMockReplyService(promptWithoutMentions: string): jest.Mocked<IReplyService<unknown, unknown, unknown, unknown>> {
  return {
    getMessageWithoutBotMentions: jest.fn(() => promptWithoutMentions),
  } as unknown as jest.Mocked<IReplyService<unknown, unknown, unknown, unknown>>;
}

function createMockTaskQueue(): jest.Mocked<ITaskQueue> {
  return {
    isActive: false,
    add: jest.fn<(task: BaseTask<unknown>) => void>(),
  } as unknown as jest.Mocked<ITaskQueue>;
}

function createMockServices(
  featureService: jest.Mocked<IFeatureService>,
  taskQueue: jest.Mocked<ITaskQueue>,
  replyService: jest.Mocked<IReplyService<unknown, unknown, unknown, unknown>>,
  getLlmGenerateStructuredTask: jest.Mock
): IBotServiceContainer {
  return {
    configurationService: null as never,
    featureService,
    taskQueue,
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
    getLlmGenerateTask: () => null as never,
    getLlmGenerateStructuredTask: getLlmGenerateStructuredTask as unknown as IBotServiceContainer['getLlmGenerateStructuredTask'],
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
  request.workflow = 'original-workflow';
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

describe('MessageToMusicMutator', () => {
  let mockFeatureService: jest.Mocked<IFeatureService>;
  let mockTaskQueue: jest.Mocked<ITaskQueue>;
  let mockReplyService: jest.Mocked<IReplyService<unknown, unknown, unknown, unknown>>;
  let mockGetLlmGenerateStructuredTask: jest.Mock;
  let mutator: MessageToMusicMutator;
  let interaction: unknown;
  let workflow: { name: string };

  beforeEach((): void => {
    mockFeatureService = createMockFeatureService(false);
    mockTaskQueue = createMockTaskQueue();
    mockReplyService = createMockReplyService('rock, upbeat, guitar');
    mockGetLlmGenerateStructuredTask = jest.fn(() => createMockStructuredTask({}));
    interaction = { content: 'ignored' };
    workflow = { name: 'music-workflow' };

    mutator = new MessageToMusicMutator(
      createMockServices(mockFeatureService, mockTaskQueue, mockReplyService, mockGetLlmGenerateStructuredTask)
    );
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('interactions', () => {
    it('should return only BotInteraction.Message', (): void => {
      expect(mutator.interactions).toEqual([BotInteraction.Message]);
    });
  });

  describe('types', () => {
    it('should return only SupportedFeature.Txt2Music', (): void => {
      expect(mutator.types).toEqual(['txt2music']);
    });
  });

  describe('contentMessage', () => {
    it('should return an empty string', (): void => {
      expect(mutator.contentMessage).toBe('');
    });
  });

  describe('additionalAttachments', () => {
    it('should return an empty array', (): void => {
      expect(mutator.additionalAttachments).toEqual([]);
    });
  });

  describe('mutate()', () => {
    describe('without Txt2Txt feature', () => {
      beforeEach((): void => {
        mockFeatureService = createMockFeatureService(false);
        mutator = new MessageToMusicMutator(
          createMockServices(mockFeatureService, mockTaskQueue, mockReplyService, mockGetLlmGenerateStructuredTask)
        );
      });

      it('should call replyService.getMessageWithoutBotMentions() with the interaction', async (): Promise<void> => {
        await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(mockReplyService.getMessageWithoutBotMentions).toHaveBeenCalledWith(interaction);
        expect(mockReplyService.getMessageWithoutBotMentions).toHaveBeenCalledTimes(1);
      });

      it('should not enqueue any LLM tasks', async (): Promise<void> => {
        await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(mockTaskQueue.add).not.toHaveBeenCalled();
        expect(mockGetLlmGenerateStructuredTask).not.toHaveBeenCalled();
      });

      it('should return a new SerializableRenderRequest instance and not mutate the input', async (): Promise<void> => {
        const input = createBaseRenderRequest();
        const originalPrompt = input.prompt;

        const result = await mutator.mutate(input, interaction as never, workflow as never);

        expect(result).not.toBe(input);
        expect(input.prompt).toBe(originalPrompt);
      });

      it('should set prompt to comma-joined tags and prompt2 to lyrics when prompt contains a separator', async (): Promise<void> => {
        mockReplyService.getMessageWithoutBotMentions = jest.fn(() => 'rock, upbeat, guitar\n\n[verse] Some lyrics here');
        mutator = new MessageToMusicMutator(
          createMockServices(mockFeatureService, mockTaskQueue, mockReplyService, mockGetLlmGenerateStructuredTask)
        );

        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(result.prompt).toBe('rock, upbeat, guitar');
        expect(result.prompt2).toBe('[verse] Some lyrics here');
      });

      it('should set prompt2 to empty string and treat entire prompt as tags when no separator present', async (): Promise<void> => {
        mockReplyService.getMessageWithoutBotMentions = jest.fn(() => 'rock, upbeat, guitar');
        mutator = new MessageToMusicMutator(
          createMockServices(mockFeatureService, mockTaskQueue, mockReplyService, mockGetLlmGenerateStructuredTask)
        );

        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(result.prompt).toBe('rock, upbeat, guitar');
        expect(result.prompt2).toBe('');
      });

      it('should assign random bpm within BpmConstants range', async (): Promise<void> => {
        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(result.bpm).toBeGreaterThanOrEqual(BpmConstants.min);
        expect(result.bpm).toBeLessThanOrEqual(BpmConstants.max);
      });

      it('should assign a valid KeyScale value', async (): Promise<void> => {
        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(Object.values(KeyScale)).toContain(result.keyScale);
      });

      it('should assign a valid numeric TimeSignature value', async (): Promise<void> => {
        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(Object.values(TimeSignature)).toContain(result.timeSignature);
      });

      it('should set the workflow name on the result', async (): Promise<void> => {
        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(result.workflow).toBe('music-workflow');
      });

      it('should refresh the seed to a new value within valid range', async (): Promise<void> => {
        const input = createBaseRenderRequest({ seed: 12345 });

        const result = await mutator.mutate(input, interaction as never, workflow as never);

        expect(result.seed).toBeGreaterThanOrEqual(0);
        expect(result.seed).toBeLessThanOrEqual(4294967294);
      });

      it('should set duration to a random int within durationMin/durationMax when both are defined', async (): Promise<void> => {
        const input = createBaseRenderRequest({ durationMin: 10, durationMax: 30 });

        const result = await mutator.mutate(input, interaction as never, workflow as never);

        expect(result.duration).toBeGreaterThanOrEqual(10);
        expect(result.duration).toBeLessThanOrEqual(30);
      });

      it('should not set duration when only durationMin is defined', async (): Promise<void> => {
        const input = createBaseRenderRequest({ durationMin: 10, duration: undefined });

        const result = await mutator.mutate(input, interaction as never, workflow as never);

        expect(result.duration).toBeUndefined();
      });

      it('should not set duration when only durationMax is defined', async (): Promise<void> => {
        const input = createBaseRenderRequest({ durationMax: 30, duration: undefined });

        const result = await mutator.mutate(input, interaction as never, workflow as never);

        expect(result.duration).toBeUndefined();
      });

      it('should set prompt2 to lyrics extracted after the separator', async (): Promise<void> => {
        mockReplyService.getMessageWithoutBotMentions = jest.fn(() => 'rock\n\n[verse] lyrics here');
        mutator = new MessageToMusicMutator(
          createMockServices(mockFeatureService, mockTaskQueue, mockReplyService, mockGetLlmGenerateStructuredTask)
        );

        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(result.prompt).toBe('rock');
        expect(result.prompt2).toBe('[verse] lyrics here');
      });

      it('should trim whitespace from each tag', async (): Promise<void> => {
        mockReplyService.getMessageWithoutBotMentions = jest.fn(() => '  rock ,  upbeat  , guitar ');
        mutator = new MessageToMusicMutator(
          createMockServices(mockFeatureService, mockTaskQueue, mockReplyService, mockGetLlmGenerateStructuredTask)
        );

        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(result.prompt).toBe('rock, upbeat, guitar');
      });
    });

    describe('with Txt2Txt feature', () => {
      const typePayload = {
        exchange: { request: {} as GenerateRequest, response: {} as GenerateResponse },
        data: { songPromptType: SongPromptType.Lyrical, promptHasTags: true, promptHasLyrics: false }
      };
      const metadataPayload = {
        exchange: { request: {} as GenerateRequest, response: {} as GenerateResponse },
        data: {
          tags: ['jazz', 'saxophone'],
          lyrics: '[verse] LLM lyrics',
          keyScale: KeyScale.EMajor,
          bpm: 120,
          timeSignature: TimeSignature.Four
        } as SongPromptMetadata
      };

      function setupMutator(
        typeData: unknown = typePayload,
        metadataData: unknown = metadataPayload
      ): MessageToMusicMutator {
        const typeTask = createMockStructuredTask(typeData);
        const metadataTask = createMockStructuredTask(metadataData);
        mockGetLlmGenerateStructuredTask = jest.fn()
          .mockReturnValueOnce(typeTask)
          .mockReturnValueOnce(metadataTask);
        mockFeatureService = createMockFeatureService(true);

        return new MessageToMusicMutator(
          createMockServices(mockFeatureService, mockTaskQueue, mockReplyService, mockGetLlmGenerateStructuredTask)
        );
      }

      beforeEach((): void => {
        mockFeatureService = createMockFeatureService(true);
      });

      it('should create two LLM structured tasks (type then metadata)', async (): Promise<void> => {
        mutator = setupMutator();

        await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(mockGetLlmGenerateStructuredTask).toHaveBeenCalledTimes(2);
      });

      it('should mark both LLM tasks as child tasks', async (): Promise<void> => {
        const typeTask = createMockStructuredTask(typePayload);
        const metadataTask = createMockStructuredTask(metadataPayload);
        mockGetLlmGenerateStructuredTask = jest.fn()
          .mockReturnValueOnce(typeTask)
          .mockReturnValueOnce(metadataTask);
        mutator = new MessageToMusicMutator(
          createMockServices(mockFeatureService, mockTaskQueue, mockReplyService, mockGetLlmGenerateStructuredTask)
        );

        await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(typeTask.isChild).toBe(true);
        expect(metadataTask.isChild).toBe(true);
      });

      it('should enqueue both LLM tasks via taskQueue.add()', async (): Promise<void> => {
        mutator = setupMutator();

        await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(mockTaskQueue.add).toHaveBeenCalledTimes(2);
      });

      it('should set prompt from LLM tags joined by comma and prompt2 from LLM lyrics', async (): Promise<void> => {
        mutator = setupMutator(typePayload, {
          exchange: { request: {} as GenerateRequest, response: {} as GenerateResponse },
          data: {
            tags: ['jazz', 'saxophone', 'smooth'],
            lyrics: '[verse] LLM lyrics',
            keyScale: KeyScale.AMinor,
            bpm: 90,
            timeSignature: TimeSignature.Three
          } as SongPromptMetadata
        });

        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(result.prompt).toBe('jazz, saxophone, smooth');
        expect(result.prompt2).toBe('[verse] LLM lyrics');
      });

      it('should set bpm, keyScale, and timeSignature from LLM metadata', async (): Promise<void> => {
        mutator = setupMutator(typePayload, {
          exchange: { request: {} as GenerateRequest, response: {} as GenerateResponse },
          data: {
            tags: ['pop'],
            lyrics: 'lyrics',
            keyScale: KeyScale.DMinor,
            bpm: 140,
            timeSignature: TimeSignature.Six
          } as SongPromptMetadata
        });

        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(result.bpm).toBe(140);
        expect(result.keyScale).toBe(KeyScale.DMinor);
        expect(result.timeSignature).toBe(TimeSignature.Six);
      });

      it('should preserve user-provided lyrics over LLM-generated lyrics when promptHasLyrics is true', async (): Promise<void> => {
        mockReplyService.getMessageWithoutBotMentions = jest.fn(() => 'rock\n\n[verse] user lyrics here');
        mutator = setupMutator(
          {
            exchange: { request: {} as GenerateRequest, response: {} as GenerateResponse },
            data: {
              tags: ['rock'],
              lyrics: '[verse] LLM generated lyrics',
              keyScale: KeyScale.EMajor,
              bpm: 120,
              timeSignature: TimeSignature.Four
            } as SongPromptMetadata
          }
        );

        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(result.prompt2).toBe('[verse] user lyrics here');
      });

      it('should use LLM lyrics when user did not provide lyrics', async (): Promise<void> => {
        mockReplyService.getMessageWithoutBotMentions = jest.fn(() => 'rock, upbeat');
        mutator = setupMutator();

        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(result.prompt2).toBe('[verse] LLM lyrics');
      });

      it('should use LLM-generated tags for the prompt', async (): Promise<void> => {
        mockReplyService.getMessageWithoutBotMentions = jest.fn(() => 'user-tag-1, user-tag-2\n\nsome lyrics');
        mutator = setupMutator(
          {
            exchange: { request: {} as GenerateRequest, response: {} as GenerateResponse },
            data: {
              tags: ['llm-tag-1', 'llm-tag-2'],
              lyrics: 'llm lyrics',
              keyScale: KeyScale.EMajor,
              bpm: 120,
              timeSignature: TimeSignature.Four
            } as SongPromptMetadata
          }
        );

        const result = await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(result.prompt).toBe('llm-tag-1, llm-tag-2');
      });

      it('should set the workflow name and refresh the seed', async (): Promise<void> => {
        mutator = setupMutator();
        const input = createBaseRenderRequest({ seed: 1 });

        const result = await mutator.mutate(input, interaction as never, workflow as never);

        expect(result.workflow).toBe('music-workflow');
        expect(result.seed).not.toBe(1);
        expect(result.seed).toBeGreaterThanOrEqual(0);
      });

      it('should set duration within range when durationMin and durationMax are defined', async (): Promise<void> => {
        mutator = setupMutator();
        const input = createBaseRenderRequest({ durationMin: 5, durationMax: 15 });

        const result = await mutator.mutate(input, interaction as never, workflow as never);

        expect(result.duration).toBeGreaterThanOrEqual(5);
        expect(result.duration).toBeLessThanOrEqual(15);
      });

      it('should reject when the song prompt type task fails', async (): Promise<void> => {
        const typeError = new Error('Type task failed');
        const typeTask = createMockStructuredTask(null, typeError);
        const metadataTask = createMockStructuredTask(metadataPayload);
        mockGetLlmGenerateStructuredTask = jest.fn()
          .mockReturnValueOnce(typeTask)
          .mockReturnValueOnce(metadataTask);
        mutator = new MessageToMusicMutator(
          createMockServices(mockFeatureService, mockTaskQueue, mockReplyService, mockGetLlmGenerateStructuredTask)
        );

        await expect(mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never))
          .rejects.toBe(typeError);
      });

      it('should reject when the metadata task fails', async (): Promise<void> => {
        const metadataError = new Error('Metadata task failed');
        const typeTask = createMockStructuredTask(typePayload);
        const metadataTask = createMockStructuredTask(null, metadataError);
        mockGetLlmGenerateStructuredTask = jest.fn()
          .mockReturnValueOnce(typeTask)
          .mockReturnValueOnce(metadataTask);
        mutator = new MessageToMusicMutator(
          createMockServices(mockFeatureService, mockTaskQueue, mockReplyService, mockGetLlmGenerateStructuredTask)
        );

        await expect(mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never))
          .rejects.toBe(metadataError);
      });

      it('should pass the prompt to getLlmGenerateStructuredTask for both tasks', async (): Promise<void> => {
        mockReplyService.getMessageWithoutBotMentions = jest.fn(() => 'the prompt text');
        mutator = setupMutator();

        await mutator.mutate(createBaseRenderRequest(), interaction as never, workflow as never);

        expect(mockGetLlmGenerateStructuredTask).toHaveBeenNthCalledWith(1, 'the prompt text', expect.any(Object));
        expect(mockGetLlmGenerateStructuredTask).toHaveBeenNthCalledWith(2, 'The song should be lyrical (with lyrics).\nthe prompt text', expect.any(Object));
      });
    });
  });
});