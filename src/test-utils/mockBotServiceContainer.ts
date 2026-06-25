import { jest } from '@jest/globals';

import { BotMode } from '../enums/BotMode.js';
import { NodeEnvironment } from '../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../enums/TaskQueueStrategy.js';
import type { IConfigurationService } from '../services/environment-settings/IConfigurationService.js';
import type { IGlobalConfiguration } from '../services/environment-settings/IGlobalConfiguration.js';
import type { IBotServiceContainer } from '../services/IBotServiceContainer.js';
import type { IGlobalServiceContainer } from '../services/IGlobalServiceContainer.js';
import type { ILogger } from '../services/ILogger.js';
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
    _logger: jest.Mocked<ILogger>;
    _postProcessor: jest.Mocked<ITaskChannelPostProcessor>;
}

/**
 * Configuration options for the mock service container
 */
export interface MockServiceContainerConfig {
    logger?: jest.Mocked<ILogger>;
    postProcessor?: jest.Mocked<ITaskChannelPostProcessor>;
    configurationService?: IConfigurationService;
    globalConfiguration?: IGlobalConfiguration;
}

/**
 * A typed container for testing global services (IGlobalServiceContainer)
 */
export interface MockGlobalContainer extends IGlobalServiceContainer {
    globalConfiguration: IGlobalConfiguration;
    configurationService: IConfigurationService;
    _logger: jest.Mocked<ILogger>;
    _postProcessor: jest.Mocked<ITaskChannelPostProcessor>;
}

/**
 * Creates a minimal mock global service container for testing TaskQueue and other IGlobalServiceContainer consumers.
 */
export function createMockGlobalContainer(config?: MockServiceContainerConfig): MockGlobalContainer {
    const logger = config?.logger ?? createMockLogger();
    const postProcessor = config?.postProcessor ?? createMockPostProcessor();

    return {
        globalConfiguration: {
            taskQueue: {
                numAttempts: 3,
                retryDelayMs: 100,
                strategy: TaskQueueStrategy.Serial,
                forceSerialAcrossHosts: false
            }
        },
        configurationService: {
            packageName: 'musebot',
            version: '8.7.1',
            nodeEnvironment: NodeEnvironment.Test,
            botId: 'bot-1',
            botFunction: BotMode.Chat,
            maxTaskAttempts: 3,
            taskRetryDelayMilliseconds: 100,
            taskQueueStrategy: TaskQueueStrategy.Serial,
            taskQueueForceSerialAcrossHosts: false,
            discordToken: 'test-token',
            discordChannels: [],
            discordChannelsDisallowed: [],
            botRequiresMention: true,
            botResponseRate: 100,
            botPrivateMessageUsers: [],
            errorMessage: 'An error occurred',
            comfyUiHosts: [],
            comfyUiGuidanceScaleInterval: 0.5,
            randomPrompts: [],
            ollamaHosts: [],
            ollamaModels: [],
            ollamaSystemPrompt: '',
            ollamaStreamsResponse: false,
            applicationName: 'Musebot',
            isProduction: false
        },
        taskQueue: null as never,
        parallelizationStrategy: {
            getTaskChannel: () => 'test_channel',
        },

        getLogger: jest.fn(() => logger),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        getTaskChannelPostProcessor: jest.fn((_services, _channelName) => postProcessor),

        // Expose mocks for test access
        _logger: logger,
        _postProcessor: postProcessor,
    };
}

/**
 * Creates a minimal mock service container for testing task-related classes.
 * This provides only the services needed by BaseTask, TaskQueue, and TaskChannel.
 */
export function createMockServiceContainer(config?: MockServiceContainerConfig): MockContainer {
    const logger = config?.logger ?? createMockLogger();
    const postProcessor = config?.postProcessor ?? createMockPostProcessor();
    const configurationService = config?.configurationService ?? {
        packageName: 'musebot',
        version: '8.7.1',
        nodeEnvironment: NodeEnvironment.Test,
        botId: 'bot-1',
        botFunction: BotMode.Chat,
        maxTaskAttempts: 3,
        taskRetryDelayMilliseconds: 100,
        taskQueueStrategy: TaskQueueStrategy.Serial,
        taskQueueForceSerialAcrossHosts: false,
        discordToken: 'test-token',
        discordChannels: [],
        discordChannelsDisallowed: [],
        botRequiresMention: true,
        botResponseRate: 100,
        botPrivateMessageUsers: [],
        errorMessage: 'An error occurred',
        comfyUiHosts: [],
        comfyUiGuidanceScaleInterval: 0.5,
        randomPrompts: [],
        ollamaHosts: [],
        ollamaModels: [],
        ollamaSystemPrompt: '',
        ollamaStreamsResponse: false,
        applicationName: 'Musebot',
        isProduction: false
    };
    const parallelizationStrategy = {
        getTaskChannel: () => 'test_channel',
    } as IParallelizationStrategy;

    // Return a properly typed mock container
    return {
        // Global settings
        configurationService: configurationService,
        // Singletons
        featureService: null as never,
        taskQueue: null as never,
        typingService: null as never,
        discordClient: null as never,
        generativeChatClient: null as never,
        helpService: null as never,
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
        getTaskChannelPostProcessor: jest.fn((_channelName?: string, _isChild?: boolean) => postProcessor),
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
        workflowService: null as never,
        _logger: logger,
        _postProcessor: postProcessor,
    };
}
