import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { BotMode } from '../../../../enums/BotMode.js';
import { NodeEnvironment } from '../../../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../../../enums/TaskQueueStrategy.js';
import type { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import type { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import type { ILogger } from '../../../ILogger.js';
import { ComfyUiClient } from './ComfyUiClient.js';

jest.mock('./extensions/ExtendedComfyUIClient.js', () => {
    return {
        ExtendedComfyUIClient: jest.fn().mockImplementation(() => ({
            free: jest.fn(),
            getSystemStats: jest.fn(),
            connect: jest.fn(),
            disconnect: jest.fn(),
            interrupt: jest.fn(),
            getMultiMedia: jest.fn(),
            queuePrompt: jest.fn(),
            getHistory: jest.fn(),
            getMedia: jest.fn(),
        })),
    };
});

import { ExtendedComfyUIClient } from './extensions/ExtendedComfyUIClient.js';

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
        botFunction: BotMode.Media,
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
        comfyUiHosts: [new URL('http://localhost:8188')],
        comfyUiGuidanceScaleInterval: 0.5,
        comfyUiFreeVerificationThreshold: 0.9,
        comfyUiMinVramFreeRatio: 0.5,
        randomPrompts: [],
        ollamaHosts: [],
        ollamaModels: [],
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

function createDeviceStats(vramTotal: number, vramFree: number): { name: string; type: string; index: number; vram_total: number; vram_free: number; torch_vram_total: number; torch_vram_free: number } {
    return { name: 'cuda:0', type: 'cuda', index: 0, vram_total: vramTotal, vram_free: vramFree, torch_vram_total: vramTotal, torch_vram_free: vramFree };
}

describe('ComfyUiClient', () => {
    let mockConfig: IConfigurationService;
    let mockLogger: jest.Mocked<ILogger>;
    let mockExtendedClient: { free: jest.Mock<() => Promise<boolean>>; getSystemStats: jest.Mock<() => Promise<unknown>> };
    let client: ComfyUiClient;

    beforeEach((): void => {
        mockLogger = createMockLogger();
        mockConfig = createMockConfigurationService();
        mockExtendedClient = {
            free: jest.fn<() => Promise<boolean>>(),
            getSystemStats: jest.fn<() => Promise<unknown>>(),
        };
        (ExtendedComfyUIClient as unknown as jest.Mock).mockImplementation(() => mockExtendedClient);

        client = new ComfyUiClient(createMockServices(mockConfig, mockLogger));
    });

    afterEach((): void => {
        jest.clearAllMocks();
    });

    describe('free()', () => {
        it('should return true when VRAM is freed above threshold', async (): Promise<void> => {
            mockExtendedClient.free.mockResolvedValue(true);
            mockExtendedClient.getSystemStats.mockResolvedValue({
                devices: [createDeviceStats(10000, 9500)]
            });

            const result = await client.free();

            expect(result).toBe(true);
            expect(mockExtendedClient.free).toHaveBeenCalledTimes(1);
            expect(mockExtendedClient.getSystemStats).toHaveBeenCalledTimes(1);
        });

        it('should retry and succeed when VRAM is freed on second attempt', async (): Promise<void> => {
            mockExtendedClient.free.mockResolvedValue(true);
            mockExtendedClient.getSystemStats
                .mockResolvedValueOnce({ devices: [createDeviceStats(10000, 5000)] })
                .mockResolvedValueOnce({ devices: [createDeviceStats(10000, 9500)] });

            const result = await client.free();

            expect(result).toBe(true);
            expect(mockExtendedClient.free).toHaveBeenCalledTimes(2);
            expect(mockExtendedClient.getSystemStats).toHaveBeenCalledTimes(2);
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        it('should return false when VRAM still occupied after retry', async (): Promise<void> => {
            mockExtendedClient.free.mockResolvedValue(true);
            mockExtendedClient.getSystemStats.mockResolvedValue({
                devices: [createDeviceStats(10000, 5000)]
            });

            const result = await client.free();

            expect(result).toBe(false);
            expect(mockExtendedClient.free).toHaveBeenCalledTimes(2);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should return false when ExtendedComfyUIClient.free returns false', async (): Promise<void> => {
            mockExtendedClient.free.mockResolvedValue(false);

            const result = await client.free();

            expect(result).toBe(false);
            expect(mockExtendedClient.getSystemStats).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should return false when getSystemStats throws', async (): Promise<void> => {
            mockExtendedClient.free.mockResolvedValue(true);
            mockExtendedClient.getSystemStats.mockRejectedValue(new Error('stats failed'));

            const result = await client.free();

            expect(result).toBe(false);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should check all devices and fail if any is below threshold', async (): Promise<void> => {
            mockExtendedClient.free.mockResolvedValue(true);
            mockExtendedClient.getSystemStats.mockResolvedValue({
                devices: [
                    createDeviceStats(10000, 9500),
                    createDeviceStats(10000, 5000)
                ]
            });

            const result = await client.free();

            expect(result).toBe(false);
        });
    });

    describe('getSystemStats()', () => {
        it('should passthrough to the extended client', async (): Promise<void> => {
            const expectedStats = { devices: [createDeviceStats(10000, 9000)] };
            mockExtendedClient.getSystemStats.mockResolvedValue(expectedStats);

            const result = await client.getSystemStats();

            expect(result).toBe(expectedStats);
            expect(mockExtendedClient.getSystemStats).toHaveBeenCalledTimes(1);
        });
    });
});