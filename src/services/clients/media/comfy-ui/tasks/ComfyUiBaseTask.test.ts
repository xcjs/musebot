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

function createMockComfyUiClient(freeResult: boolean): jest.Mocked<ComfyUiClient> {
    return {
        host: new URL('http://localhost:8188'),
        free: jest.fn<() => Promise<boolean>>().mockResolvedValue(freeResult),
        render: jest.fn(),
        disconnect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ComfyUiClient>;
}

function createMockOllamaClient(): { free: jest.MockedFunction<() => Promise<boolean>>; waitForModelUnload: jest.MockedFunction<() => Promise<boolean>> } {
    return {
        free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
        waitForModelUnload: jest.fn<() => Promise<boolean>>().mockResolvedValue(true)
    };
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
    ollamaClient: { free: jest.MockedFunction<() => Promise<boolean>>; waitForModelUnload: jest.MockedFunction<() => Promise<boolean>> },
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
        webContentService: null as never,
        parallelizationStrategy: { getTaskChannel: jest.fn(() => 'test') } as unknown as IParallelizationStrategy,
        getLogger: jest.fn(() => logger),
        getTaskChannelPostProcessor: (() => null as never) as unknown as () => ITaskChannelPostProcessor,
        getContextMessageFactory: () => null as never,
        getContextService: () => null as never,
        getLlmGenerateTask: () => null as never,
        getLlmGenerateStructuredTask: () => null as never,
        getEmojiReactionTask: () => null as never,
        getEmbedTask: () => null as never,
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
        getChatMessageFilters: () => [], getInputChatMessageFilters: () => [],
        getChatMessageFactory: () => null as never, getLlmChatMessageFactory: () => null as never, getMemoryService: () => null as never,
    };
}

function createMockConfig(overrides: Partial<IConfigurationService> = {}): IConfigurationService {
    return {
        taskQueueStrategy: TaskQueueStrategy.Serial,
        maxTaskAttempts: 3,
        ...overrides,
    } as unknown as IConfigurationService;
}

describe('ComfyUiBaseTask', () => {
    let mockLogger: jest.Mocked<ILogger>;
    let mockConfig: IConfigurationService;
    let mockFeatureService: jest.Mocked<IFeatureService>;
    let mockComfyUiClient: jest.Mocked<ComfyUiClient>;
    let mockOllamaClient: { free: jest.MockedFunction<() => Promise<boolean>>; waitForModelUnload: jest.MockedFunction<() => Promise<boolean>> };
    let mockWorkflowService: jest.Mocked<IWorkflowService>;
    let task: TestableComfyUiTask;

    beforeEach((): void => {
        mockLogger = createMockLogger();
        mockConfig = createMockConfig();
        mockFeatureService = createMockFeatureService(true);
        mockComfyUiClient = createMockComfyUiClient(true);
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
        it('should call ollama.waitForModelUnload() and not throw when it returns true', async (): Promise<void> => {
            await task.preProcess();

            expect(mockOllamaClient.waitForModelUnload).toHaveBeenCalledTimes(1);
        });

        it('should throw when ollama.waitForModelUnload() returns false', async (): Promise<void> => {
            mockOllamaClient.waitForModelUnload.mockResolvedValue(false);

            await expect(task.preProcess()).rejects.toThrow('Ollama model could not be unloaded');
        });

        it('should not call ollama.waitForModelUnload() when not in serial mode', async (): Promise<void> => {
            const parallelConfig = createMockConfig({ taskQueueStrategy: TaskQueueStrategy.Parallel });
            task = new TestableComfyUiTask(createMockServices(
                parallelConfig, mockLogger, mockFeatureService, mockComfyUiClient, mockOllamaClient, mockWorkflowService
            ));

            await task.preProcess();

            expect(mockOllamaClient.waitForModelUnload).not.toHaveBeenCalled();
        });

        it('should not call ollama.waitForModelUnload() when Txt2Txt feature is unavailable', async (): Promise<void> => {
            const noTxt2Txt = createMockFeatureService(false);
            task = new TestableComfyUiTask(createMockServices(
                mockConfig, mockLogger, noTxt2Txt, mockComfyUiClient, mockOllamaClient, mockWorkflowService
            ));

            await task.preProcess();

            expect(mockOllamaClient.waitForModelUnload).not.toHaveBeenCalled();
        });
    });

    describe('process()', () => {
        it('should load workflows', async (): Promise<void> => {
            await task.process();

            expect(mockWorkflowService.loadWorkflows).toHaveBeenCalledTimes(1);
        });
    });
});