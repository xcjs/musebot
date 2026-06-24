import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TaskQueueStrategy } from '../../../../../enums/TaskQueueStrategy.js';
import type { IConfigurationService } from '../../../../environment-settings/IConfigurationService.js';
import type { IFeatureService } from '../../../../features/IFeatureService.js';
import type { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import type { ILogger } from '../../../../ILogger.js';
import type { IParallelizationStrategy } from '../../../../parallelization/IParallelizationStrategy.js';
import type { ITaskChannelPostProcessor } from '../../../../parallelization/ITaskChannelPostProcessor.js';
import type { ComfyUiClient } from '../ComfyUiClient.js';
import type { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

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
        hasFeature: jest.fn(() => hasTxt2Txt),
    } as unknown as jest.Mocked<IFeatureService>;
}

function createMockComfyUiClient(freeResult: boolean, statsDevices: { name: string; type: string; index: number; vram_total: number; vram_free: number; torch_vram_total: number; torch_vram_free: number }[]): jest.Mocked<ComfyUiClient> {
    return {
        host: new URL('http://localhost:8188'),
        free: jest.fn<() => Promise<boolean>>().mockResolvedValue(freeResult),
        getSystemStats: jest.fn<() => Promise<{ devices: { name: string; type: string; index: number; vram_total: number; vram_free: number; torch_vram_total: number; torch_vram_free: number }[] }>>().mockResolvedValue({ devices: statsDevices }),
        render: jest.fn(),
        disconnect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ComfyUiClient>;
}

function createMockOllamaClient(): { free: jest.MockedFunction<() => Promise<boolean>> } {
    return { free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true) };
}

function createMockWorkflowService(): jest.Mocked<IWorkflowService> {
    return {
        loadWorkflows: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IWorkflowService>;
}

class TestableComfyUiTask extends ComfyUiBaseTask {
    override async process(): Promise<void> {
        await super.process();
    }
}

function createMockServices(
    config: IConfigurationService,
    logger: jest.Mocked<ILogger>,
    featureService: jest.Mocked<IFeatureService>,
    comfyUiClient: jest.Mocked<ComfyUiClient>,
    ollamaClient: { free: jest.MockedFunction<() => Promise<boolean>> },
    workflowService: jest.Mocked<IWorkflowService>
): IBotServiceContainer {
    return {
        configurationService: config,
        featureService,
        taskQueue: null as never,
        typingService: null as never,
        discordClient: null as never,
        generativeChatClient: null as never,
        helpService: null as never,
        workflowService,
        parallelizationStrategy: { getTaskChannel: jest.fn(() => 'test') } as unknown as IParallelizationStrategy,
        getLogger: jest.fn(() => logger),
        getTaskChannelPostProcessor: (() => null as never) as unknown as () => ITaskChannelPostProcessor,
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
        comfyUiClient,
        comfyUiReplyService: null as never,
        ollamaClient: ollamaClient as never,
        ollamaReplyService: null as never,
        ollamaStreamingReplyService: null as never,
        actionRowBuilderFactory: null as never,
    };
}

function createMockConfig(overrides: Partial<IConfigurationService> = {}): IConfigurationService {
    return {
        taskQueueStrategy: TaskQueueStrategy.Serial,
        comfyUiMinVramFreeRatio: 0.9,
        maxTaskAttempts: 3,
        ...overrides,
    } as unknown as IConfigurationService;
}

function createDevice(vramTotal: number, vramFree: number): { name: string; type: string; index: number; vram_total: number; vram_free: number; torch_vram_total: number; torch_vram_free: number } {
    return { name: 'cuda:0', type: 'cuda', index: 0, vram_total: vramTotal, vram_free: vramFree, torch_vram_total: vramTotal, torch_vram_free: vramFree };
}

describe('ComfyUiBaseTask', () => {
    let mockLogger: jest.Mocked<ILogger>;
    let mockConfig: IConfigurationService;
    let mockFeatureService: jest.Mocked<IFeatureService>;
    let mockComfyUiClient: jest.Mocked<ComfyUiClient>;
    let mockOllamaClient: { free: jest.MockedFunction<() => Promise<boolean>> };
    let mockWorkflowService: jest.Mocked<IWorkflowService>;
    let task: TestableComfyUiTask;

    beforeEach((): void => {
        mockLogger = createMockLogger();
        mockConfig = createMockConfig();
        mockFeatureService = createMockFeatureService(true);
        mockComfyUiClient = createMockComfyUiClient(true, [createDevice(10000, 9500)]);
        mockOllamaClient = createMockOllamaClient();
        mockWorkflowService = createMockWorkflowService();

        task = new TestableComfyUiTask(createMockServices(
            mockConfig, mockLogger, mockFeatureService, mockComfyUiClient, mockOllamaClient, mockWorkflowService
        ));
    });

    afterEach((): void => {
        jest.clearAllMocks();
    });

    describe('preProcess()', () => {
        it('should call ollama.free() and not throw when it returns true', async (): Promise<void> => {
            await task.preProcess();

            expect(mockOllamaClient.free).toHaveBeenCalledTimes(1);
        });

        it('should throw when ollama.free() returns false', async (): Promise<void> => {
            mockOllamaClient.free.mockResolvedValue(false);

            await expect(task.preProcess()).rejects.toThrow('Ollama model could not be unloaded');
        });

        it('should not call ollama.free() when not in serial mode', async (): Promise<void> => {
            const parallelConfig = createMockConfig({ taskQueueStrategy: TaskQueueStrategy.Parallel });
            task = new TestableComfyUiTask(createMockServices(
                parallelConfig, mockLogger, mockFeatureService, mockComfyUiClient, mockOllamaClient, mockWorkflowService
            ));

            await task.preProcess();

            expect(mockOllamaClient.free).not.toHaveBeenCalled();
        });

        it('should not call ollama.free() when Txt2Txt feature is unavailable', async (): Promise<void> => {
            const noTxt2Txt = createMockFeatureService(false);
            task = new TestableComfyUiTask(createMockServices(
                mockConfig, mockLogger, noTxt2Txt, mockComfyUiClient, mockOllamaClient, mockWorkflowService
            ));

            await task.preProcess();

            expect(mockOllamaClient.free).not.toHaveBeenCalled();
        });
    });

    describe('process()', () => {
        it('should load workflows and pass VRAM gate when sufficient', async (): Promise<void> => {
            await task.process();

            expect(mockWorkflowService.loadWorkflows).toHaveBeenCalledTimes(1);
            expect(mockComfyUiClient.getSystemStats).toHaveBeenCalledTimes(1);
        });

        it('should throw when VRAM free ratio is below minVramFreeRatio', async (): Promise<void> => {
            mockComfyUiClient.getSystemStats.mockResolvedValue({
                devices: [createDevice(10000, 4000)]
            });

            await expect(task.process()).rejects.toThrow('Insufficient VRAM');
        });

        it('should pass when VRAM is exactly at threshold', async (): Promise<void> => {
            mockComfyUiClient.getSystemStats.mockResolvedValue({
                devices: [createDevice(10000, 9000)]
            });

            await expect(task.process()).resolves.toBeUndefined();
        });

        it('should throw when any one device is below threshold', async (): Promise<void> => {
            mockComfyUiClient.getSystemStats.mockResolvedValue({
                devices: [createDevice(10000, 9000), createDevice(10000, 3000)]
            });

            await expect(task.process()).rejects.toThrow('Insufficient VRAM');
        });

        it('should respect custom minVramFreeRatio from config', async (): Promise<void> => {
            const customConfig = createMockConfig({ comfyUiMinVramFreeRatio: 0.2 });
            task = new TestableComfyUiTask(createMockServices(
                customConfig, mockLogger, mockFeatureService, mockComfyUiClient, mockOllamaClient, mockWorkflowService
            ));
            mockComfyUiClient.getSystemStats.mockResolvedValue({
                devices: [createDevice(10000, 3000)]
            });

            await expect(task.process()).resolves.toBeUndefined();
        });
    });
});