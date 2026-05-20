import { jest } from '@jest/globals';

import type { IEnvironmentSettings } from '../services/environment-settings/IEnvironmentSettings.js';
import type { IGlobalSettings } from '../services/environment-settings/IGlobalSettings.js';
import type { ILogger } from '../services/ILogger.js';
import type { IServiceContainer, IBotServiceContainer } from '../services/IServiceContainer.js';
import type { IParallelizationStrategy } from '../services/parallelization/IParallelizationStrategy.js';
import type { ITaskChannelPostProcessor } from '../services/parallelization/ITaskChannelPostProcessor.js';

/**
 * Creates a mock logger for testing
 */
export function createMockLogger(): jest.Mocked<ILogger> {
    return {
        debug: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
    };
}

/**
 * Creates a mock task channel post processor for testing
 */
export function createMockPostProcessor(): jest.Mocked<ITaskChannelPostProcessor> {
    return {
        postProcess: jest.fn(() => Promise.resolve()),
    };
}

/**
 * A typed container for testing that exposes the mocks
 */
export interface MockContainer extends IBotServiceContainer {
    globalSettings: IGlobalSettings;
    _logger: jest.Mocked<ILogger>;
    _postProcessor: jest.Mocked<ITaskChannelPostProcessor>;
}

/**
 * Configuration options for the mock service container
 */
export interface MockServiceContainerConfig {
    logger?: jest.Mocked<ILogger>;
    postProcessor?: jest.Mocked<ITaskChannelPostProcessor>;
    environmentSettings?: IEnvironmentSettings;
    globalSettings?: IGlobalSettings;
}

/**
 * Creates a minimal mock service container for testing task-related classes.
 * This provides only the services needed by BaseTask, TaskQueue, and TaskChannel.
 */
export function createMockServiceContainer(config?: MockServiceContainerConfig): MockContainer {
    const logger = config?.logger ?? createMockLogger();
    const postProcessor = config?.postProcessor ?? createMockPostProcessor();
    const environmentSettings = config?.environmentSettings ?? {
        maxTaskAttempts: 3,
        taskRetryDelayMilliseconds: 100,
        taskQueueForceSerialAcrossHosts: false,
    } as IEnvironmentSettings;
    const globalSettings = config?.globalSettings ?? {
        maxTaskAttempts: 3,
        taskRetryDelayMilliseconds: 100,
        taskQueueForceSerialAcrossHosts: false,
        taskQueueStrategy: 'serial',
    } as IGlobalSettings;
    const parallelizationStrategy = {
        getTaskChannel: () => 'test_channel',
    } as IParallelizationStrategy;

    // Return a properly typed mock container
    return {
        // Global settings
        globalSettings: globalSettings,
        // Singletons
        environmentSettings: environmentSettings,
        featureService: null as never,
        taskQueue: null as never,
        typingService: null as never,
        discordClient: null as never,
        generativeChatClient: null as never,
        helpService: null as never,
        workflowService: null as never,
        parallelizationStrategy: parallelizationStrategy,

        // Transients
        contentTypeService: null as never,
        comfyUiClient: null as never,
        comfyUiReplyService: null as never,
        ollamaClient: null as never,
        ollamaReplyService: null as never,
        ollamaStreamingReplyService: null as never,
        actionRowBuilderFactory: null as never,

        // Factories
        getLogger: jest.fn(() => logger),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        getTaskChannelPostProcessor: jest.fn((_services?: IBotServiceContainer, _channelName?: string, _isChild?: boolean) => postProcessor),
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

        // Expose mocks for test access
        _logger: logger,
        _postProcessor: postProcessor,
    };
}
