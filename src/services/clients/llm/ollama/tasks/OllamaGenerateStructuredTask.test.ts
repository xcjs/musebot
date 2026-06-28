import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GenerateRequest, GenerateResponse } from 'ollama';

import { TaskQueueStrategy } from '../../../../../enums/TaskQueueStrategy.js';
import { IHttpExchangeWithAttachedData } from '../../../../../models/IHttpExchangeWithAttachedData.js';
import type { IConfigurationService } from '../../../../environment-settings/IConfigurationService.js';
import type { IFeatureService } from '../../../../features/IFeatureService.js';
import type { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import type { ILogger } from '../../../../ILogger.js';
import type { IParallelizationStrategy } from '../../../../parallelization/IParallelizationStrategy.js';
import type { ITaskChannelPostProcessor } from '../../../../parallelization/ITaskChannelPostProcessor.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import type { ComfyUiClient } from '../../../media/comfy-ui/ComfyUiClient.js';
import type { IStructuredRequestData } from '../models/IStructuredRequestData.js';
import type { OllamaClient } from '../OllamaClient.js';
import { OllamaGenerateStructuredTask } from './OllamaGenerateStructuredTask.js';

interface TestOutput {
    name: string;
    value: number;
}

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

function createMockStructuredRequestData(): IStructuredRequestData {
    return {
        systemPrompt: 'You are a helpful assistant.',
        schema: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'number' } } }
    };
}

function createMockOllamaClient(structuredResponse?: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, TestOutput>): jest.Mocked<OllamaClient> {
    return {
        host: new URL('http://localhost:11434'),
        free: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
        generate: jest.fn(),
        generateStructured: jest.fn<() => Promise<IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, TestOutput>>>()
            .mockResolvedValue(structuredResponse ?? {
                exchange: {
                    request: {} as GenerateRequest,
                    response: { response: 'test' } as unknown as GenerateResponse
                },
                data: { name: 'test', value: 42 } as TestOutput
            }),
        sendMessage: jest.fn(),
        sendMessageAndGetStream: jest.fn(),
        isModelLoaded: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
    } as unknown as jest.Mocked<OllamaClient>;
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
        ollamaClient,
        ollamaReplyService: null as never,
        ollamaStreamingReplyService: null as never,
        actionRowBuilderFactory: null as never,
        getChatMessageFilters: () => [], getInputChatMessageFilters: () => [],
        getChatMessageFactory: () => null as never, getLlmChatMessageFactory: () => null as never, getMemoryService: () => null as never,
    };
}

function createMockConfig(overrides: Partial<IConfigurationService> = {}): IConfigurationService {
    return {
        taskQueueStrategy: TaskQueueStrategy.Parallel,
        maxTaskAttempts: 3,
        ...overrides,
    } as unknown as IConfigurationService;
}

describe('OllamaGenerateStructuredTask', () => {
    let mockLogger: jest.Mocked<ILogger>;
    let mockConfig: IConfigurationService;
    let mockFeatureService: jest.Mocked<IFeatureService>;
    let mockComfyUiClient: jest.Mocked<ComfyUiClient>;
    let mockOllamaClient: jest.Mocked<OllamaClient>;
    let structuredRequestData: IStructuredRequestData;
    let task: OllamaGenerateStructuredTask<TestOutput>;

    beforeEach((): void => {
        mockLogger = createMockLogger();
        mockConfig = createMockConfig();
        mockFeatureService = createMockFeatureService(false);
        mockComfyUiClient = createMockComfyUiClient(true);
        mockOllamaClient = createMockOllamaClient();
        structuredRequestData = createMockStructuredRequestData();

        task = new OllamaGenerateStructuredTask<TestOutput>(
            createMockServices(mockConfig, mockLogger, mockFeatureService, mockComfyUiClient, mockOllamaClient),
            'test prompt',
            structuredRequestData
        );
    });

    afterEach((): void => {
        jest.clearAllMocks();
    });

    describe('process()', () => {
        it('should call ollamaClient.generateStructured() with the prompt and structured request data', async (): Promise<void> => {
            await task.process();

            expect(mockOllamaClient.generateStructured).toHaveBeenCalledWith('test prompt', structuredRequestData);
        });
    });

    describe('postProcess()', () => {
        it('should invoke onSuccess callback with the structured exchange when taskStatus is Successful', async (): Promise<void> => {
            await task.process();

            task.taskStatus = TaskStatus.Successful;

            const onSuccess = jest.fn<(payload: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, TestOutput>) => void>();
            task.onSuccess = onSuccess;

            await task.postProcess();

            expect(onSuccess).toHaveBeenCalledTimes(1);
            expect(onSuccess.mock.calls[0][0].data).toEqual({ name: 'test', value: 42 });
        });

        it('should not invoke onSuccess when taskStatus is Successful but exchange is null', async (): Promise<void> => {
            task.taskStatus = TaskStatus.Successful;

            const onSuccess = jest.fn<(payload: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, TestOutput>) => void>();
            task.onSuccess = onSuccess;

            await task.postProcess();

            expect(onSuccess).not.toHaveBeenCalled();
        });

        it('should invoke onFailure callback with lastError when taskStatus is Dead', async (): Promise<void> => {
            const testError = new Error('Structured generation failed');
            task.lastError = testError;

            task.taskStatus = TaskStatus.Failed;
            task.taskStatus = TaskStatus.Failed;
            task.taskStatus = TaskStatus.Failed;

            const onFailure = jest.fn<(error: Error) => void>();
            task.onFailure = onFailure;

            await task.postProcess();

            expect(onFailure).toHaveBeenCalledTimes(1);
            expect(onFailure.mock.calls[0][0]).toBe(testError);
        });

        it('should invoke onFailure with a fallback error when lastError is null and taskStatus is Dead', async (): Promise<void> => {
            task.taskStatus = TaskStatus.Failed;
            task.taskStatus = TaskStatus.Failed;
            task.taskStatus = TaskStatus.Failed;

            const onFailure = jest.fn<(error: Error) => void>();
            task.onFailure = onFailure;

            await task.postProcess();

            expect(onFailure).toHaveBeenCalledTimes(1);
            expect(onFailure.mock.calls[0][0]).toBeInstanceOf(Error);
            expect(onFailure.mock.calls[0][0].message).toBe('Task died without a captured error.');
        });

        it('should not invoke onSuccess or onFailure when taskStatus is Idle', async (): Promise<void> => {
            const onSuccess = jest.fn<(payload: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, TestOutput>) => void>();
            const onFailure = jest.fn<(error: Error) => void>();
            task.onSuccess = onSuccess;
            task.onFailure = onFailure;

            await task.postProcess();

            expect(onSuccess).not.toHaveBeenCalled();
            expect(onFailure).not.toHaveBeenCalled();
        });
    });
});