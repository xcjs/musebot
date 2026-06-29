import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TaskQueueStrategy } from '../../../../../enums/TaskQueueStrategy.js';
import type { IConfigurationService } from '../../../../environment-settings/IConfigurationService.js';
import type { IFeatureService } from '../../../../features/IFeatureService.js';
import type { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import type { ILogger } from '../../../../ILogger.js';
import type { IParallelizationStrategy } from '../../../../parallelization/IParallelizationStrategy.js';
import type { ITaskChannelPostProcessor } from '../../../../parallelization/ITaskChannelPostProcessor.js';
import type { ComfyUiClient } from '../../../media/comfy-ui/ComfyUiClient.js';
import type { OllamaClient } from '../OllamaClient.js';
import { OllamaBaseTask } from './OllamaBaseTask.js';

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

function createMockFeatureService(hasMediaFeatures: boolean): jest.Mocked<IFeatureService> {
    return {
        hasFeature: jest.fn(() => hasMediaFeatures),
    } as unknown as jest.Mocked<IFeatureService>;
}

function createMockComfyUiClient(freeResult: boolean): jest.Mocked<ComfyUiClient> {
    return {
        host: new URL('http://localhost:8188'),
        free: jest.fn<() => Promise<boolean>>().mockResolvedValue(freeResult),
        getSystemStats: jest.fn<() => Promise<unknown>>(),
        render: jest.fn(),
        disconnect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ComfyUiClient>;
}

function createMockOllamaClient(): jest.Mocked<OllamaClient> {
    return {
        host: new URL('http://localhost:11434'),
        free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
        generate: jest.fn(),
        generateStructured: jest.fn(),
        sendMessage: jest.fn(),
        sendMessageAndGetStream: jest.fn(),
        isModelLoaded: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
    } as unknown as jest.Mocked<OllamaClient>;
}

class TestableOllamaTask extends OllamaBaseTask<unknown> {
    override async process(): Promise<void> {
        await super.process();
    }
}

function createMockServices(
    config: IConfigurationService,
    logger: jest.Mocked<ILogger>,
    featureService: jest.Mocked<IFeatureService>,
    comfyUiClient: jest.Mocked<ComfyUiClient>,
    ollamaClient: jest.Mocked<OllamaClient>
): IBotServiceContainer {
    return {
        configurationService: config,
        featureService,
        taskQueue: null as never,
        typingService: null as never,
        discordClient: null as never,
        generativeChatClient: null as never,
        helpService: null as never,
        workflowService: null as never,
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
        comfyUiClient: comfyUiClient,
        comfyUiReplyService: null as never,
        ollamaClient: ollamaClient,
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

describe('OllamaBaseTask', () => {
    let mockLogger: jest.Mocked<ILogger>;
    let mockConfig: IConfigurationService;
    let mockFeatureService: jest.Mocked<IFeatureService>;
    let mockComfyUiClient: jest.Mocked<ComfyUiClient>;
    let mockOllamaClient: jest.Mocked<OllamaClient>;
    let task: TestableOllamaTask;

    beforeEach((): void => {
        mockLogger = createMockLogger();
        mockConfig = createMockConfig();
        mockFeatureService = createMockFeatureService(true);
        mockComfyUiClient = createMockComfyUiClient(true);
        mockOllamaClient = createMockOllamaClient();

        task = new TestableOllamaTask(createMockServices(
            mockConfig, mockLogger, mockFeatureService, mockComfyUiClient, mockOllamaClient
        ));
    });

    afterEach((): void => {
        jest.clearAllMocks();
    });

    describe('preProcess()', () => {
        it('should call comfyUi.free() and not throw when it returns true', async (): Promise<void> => {
            await task.preProcess();

            expect(mockComfyUiClient.free).toHaveBeenCalledTimes(1);
        });

        it('should throw when comfyUi.free() returns false', async (): Promise<void> => {
            mockComfyUiClient.free.mockResolvedValue(false);

            await expect(task.preProcess()).rejects.toThrow('ComfyUI VRAM could not be freed');
        });

        it('should not call comfyUi.free() when not in serial mode', async (): Promise<void> => {
            const parallelConfig = createMockConfig({ taskQueueStrategy: TaskQueueStrategy.Parallel });
            task = new TestableOllamaTask(createMockServices(
                parallelConfig, mockLogger, mockFeatureService, mockComfyUiClient, mockOllamaClient
            ));

            await task.preProcess();

            expect(mockComfyUiClient.free).not.toHaveBeenCalled();
        });

        it('should not call comfyUi.free() when no media features are available', async (): Promise<void> => {
            const noMedia = createMockFeatureService(false);
            task = new TestableOllamaTask(createMockServices(
                mockConfig, mockLogger, noMedia, mockComfyUiClient, mockOllamaClient
            ));

            await task.preProcess();

            expect(mockComfyUiClient.free).not.toHaveBeenCalled();
        });
    });
});