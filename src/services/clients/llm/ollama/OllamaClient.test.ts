import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { BotMode } from '../../../../enums/BotMode.js';
import { NodeEnvironment } from '../../../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../../../enums/TaskQueueStrategy.js';
import type { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import type { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import type { ILogger } from '../../../ILogger.js';
import { OllamaClient } from './OllamaClient.js';

jest.mock('ollama', () => {
    const mockOllama = jest.fn().mockImplementation(() => ({
        generate: jest.fn(),
        ps: jest.fn(),
        chat: jest.fn()
    }));
    return { Ollama: mockOllama, __esModule: true };
});

import { Ollama } from 'ollama';

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

function createMockConfigurationService(overrides: Partial<IConfigurationService> = {}): IConfigurationService {
    return {
        packageName: 'musebot',
        version: '9.0.12',
        nodeEnvironment: NodeEnvironment.Test,
        botId: 'bot-1',
        botFunction: BotMode.Chat,
        discordToken: 'token',
        discordChannels: [],
        discordChannelsDisallowed: [],
        botRequiresMention: false,
        botResponseRate: 100,
        botPrivateMessageUsers: [],
        errorMessage: 'error',
        maxTaskAttempts: 3,
        taskRetryDelayMilliseconds: 100,
        taskQueueStrategy: TaskQueueStrategy.Serial,
        taskQueueForceSerialAcrossHosts: false,
        comfyUiHosts: [],
        comfyUiGuidanceScaleInterval: 0.5,
        comfyUiFreeVerificationThreshold: 0.9,
        comfyUiMinVramFreeRatio: 0.5,
        randomPrompts: [],
        ollamaHosts: [new URL('http://localhost:11434')],
        ollamaModels: ['test-model'],
        ollamaSystemPrompt: '',
        ollamaStreamsResponse: false,
        applicationName: 'Musebot',
        isProduction: false,
        ...overrides,
    };
}

function createMockServices(config: IConfigurationService, logger: jest.Mocked<ILogger>): IBotServiceContainer {
    return {
        configurationService: config,
        featureService: null as never,
        taskQueue: null as never,
        typingService: null as never,
        discordClient: null as never,
        generativeChatClient: { name: 'TestBot' } as never,
        helpService: null as never,
        workflowService: null as never,
        parallelizationStrategy: null as never,
        getLogger: jest.fn(() => logger),
        getTaskChannelPostProcessor: () => null as never,
        getContextMessageFactory: () => null as never,
        getContextService: () => null as never,
        getLlmGenerateTask: () => null as never,
        getLlmGenerateStructuredTask: () => null as never,
        getEmojiReactionTask: () => null as never,
        getMessageTask: () => null as never,
        getInteractionTask: () => null as never,
        getAttachmentTask: () => null as never,
        getCustomInteractionTask: () => null as never,
        getWorkflowMutator: () => null as never,
        getReplyService: () => null as never,
        contentTypeService: null as never,
        comfyUiClient: null as never,
        comfyUiReplyService: null as never,
        ollamaClient: null as never,
        ollamaReplyService: null as never,
        ollamaStreamingReplyService: null as never,
        actionRowBuilderFactory: null as never,
    };
}

describe('OllamaClient', () => {
    let mockConfig: IConfigurationService;
    let mockLogger: jest.Mocked<ILogger>;
    let mockOllamaInstance: { generate: jest.Mock<() => Promise<unknown>>; ps: jest.Mock<() => Promise<{ models: Array<{ name: string; model?: string }> }>>; chat: jest.Mock<() => Promise<unknown>> };
    let client: OllamaClient;

    beforeEach((): void => {
        mockLogger = createMockLogger();
        mockConfig = createMockConfigurationService();
        mockOllamaInstance = {
            generate: jest.fn<() => Promise<unknown>>(),
            ps: jest.fn<() => Promise<{ models: Array<{ name: string; model: string }> }>>(),
            chat: jest.fn<() => Promise<unknown>>(),
        };
        (Ollama as unknown as jest.Mock).mockImplementation(() => mockOllamaInstance);

        client = new OllamaClient(createMockServices(mockConfig, mockLogger));
    });

    afterEach((): void => {
        jest.clearAllMocks();
    });

    describe('free()', () => {
        it('should return true when model is unloaded after keep_alive: 0', async (): Promise<void> => {
            mockOllamaInstance.generate.mockResolvedValue({});
            mockOllamaInstance.ps.mockResolvedValue({ models: [] });

            const result = await client.free();

            expect(result).toBe(true);
            expect(mockOllamaInstance.generate).toHaveBeenCalledTimes(1);
            expect(mockOllamaInstance.ps).toHaveBeenCalledTimes(1);
        });

        it('should retry once and succeed when model unloads on second attempt', async (): Promise<void> => {
            mockOllamaInstance.generate.mockResolvedValue({});
            mockOllamaInstance.ps
                .mockResolvedValueOnce({ models: [{ name: 'test-model' }] })
                .mockResolvedValueOnce({ models: [] });

            const result = await client.free();

            expect(result).toBe(true);
            expect(mockOllamaInstance.generate).toHaveBeenCalledTimes(2);
            expect(mockOllamaInstance.ps).toHaveBeenCalledTimes(2);
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        });

        it('should return false when model still loaded after retry', async (): Promise<void> => {
            mockOllamaInstance.generate.mockResolvedValue({});
            mockOllamaInstance.ps.mockResolvedValue({ models: [{ name: 'test-model' }] });

            const result = await client.free();

            expect(result).toBe(false);
            expect(mockOllamaInstance.generate).toHaveBeenCalledTimes(2);
            expect(mockOllamaInstance.ps).toHaveBeenCalledTimes(2);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should return false when generate throws', async (): Promise<void> => {
            mockOllamaInstance.generate.mockRejectedValue(new Error('network error'));

            const result = await client.free();

            expect(result).toBe(false);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should return false when ps throws', async (): Promise<void> => {
            mockOllamaInstance.generate.mockResolvedValue({});
            mockOllamaInstance.ps.mockRejectedValue(new Error('ps failed'));

            const result = await client.free();

            expect(result).toBe(false);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('isModelLoaded()', () => {
        it('should return true when model is in ps list', async (): Promise<void> => {
            mockOllamaInstance.ps.mockResolvedValue({ models: [{ name: 'test-model' }] });

            const result = await client.isModelLoaded();

            expect(result).toBe(true);
        });

        it('should return false when model is not in ps list', async (): Promise<void> => {
            mockOllamaInstance.ps.mockResolvedValue({ models: [{ name: 'other-model' }] });

            const result = await client.isModelLoaded();

            expect(result).toBe(false);
        });

        it('should return false when ps returns empty models', async (): Promise<void> => {
            mockOllamaInstance.ps.mockResolvedValue({ models: [] });

            const result = await client.isModelLoaded();

            expect(result).toBe(false);
        });

        it('should match on model field as well as name', async (): Promise<void> => {
            mockOllamaInstance.ps.mockResolvedValue({ models: [{ name: 'different', model: 'test-model' }] });

            const result = await client.isModelLoaded();

            expect(result).toBe(true);
        });
    });
});