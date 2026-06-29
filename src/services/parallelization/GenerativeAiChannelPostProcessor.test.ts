import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { OllamaClient } from '../clients/llm/ollama/OllamaClient.js';
import type { ComfyUiClient } from '../clients/media/comfy-ui/ComfyUiClient.js';
import type { IConfigurationService } from '../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../features/enum/SupportedFeature.js';
import type { IFeatureService } from '../features/IFeatureService.js';
import type { IBotServiceContainer } from '../IBotServiceContainer.js';
import type { ILogger } from '../ILogger.js';
import { GenerativeAiChannelPostProcessor } from './GenerativeAiChannelPostProcessor.js';
import type { ITaskChannelPostProcessor } from './ITaskChannelPostProcessor.js';

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

function createMockFeatureService(hasTxt2Txt: boolean, hasMedia: boolean): jest.Mocked<IFeatureService> {
    return {
        hasFeature: jest.fn((feature) => {
            if (feature === SupportedFeature.Txt2Txt) return hasTxt2Txt;
            return hasMedia;
        }),
    } as unknown as jest.Mocked<IFeatureService>;
}

function createMockOllamaClient(freeResult: boolean): jest.Mocked<OllamaClient> {
    return {
        free: jest.fn<() => Promise<boolean>>().mockResolvedValue(freeResult),
    } as unknown as jest.Mocked<OllamaClient>;
}

function createMockComfyUiClient(freeResult: boolean): jest.Mocked<ComfyUiClient> {
    return {
        free: jest.fn<() => Promise<boolean>>().mockResolvedValue(freeResult),
    } as unknown as jest.Mocked<ComfyUiClient>;
}

function createMockServices(
    logger: jest.Mocked<ILogger>,
    featureService: jest.Mocked<IFeatureService>,
    ollamaClient: jest.Mocked<OllamaClient>,
    comfyUiClient: jest.Mocked<ComfyUiClient>
): IBotServiceContainer {
    return {
        configurationService: {} as unknown as IConfigurationService,
        featureService,
        taskQueue: null as never,
        typingService: null as never,
        discordClient: null as never,
        generativeChatClient: null as never,
        helpService: null as never,
        workflowService: null as never,
        webContentService: null as never,
        parallelizationStrategy: null as never,
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
        ollamaClient,
        ollamaReplyService: null as never,
        ollamaStreamingReplyService: null as never,
        actionRowBuilderFactory: null as never,
        getChatMessageFilters: () => [], getInputChatMessageFilters: () => [],
        getChatMessageFactory: () => null as never, getLlmChatMessageFactory: () => null as never, getMemoryService: () => null as never,
    };
}

describe('GenerativeAiChannelPostProcessor', () => {
    let mockLogger: jest.Mocked<ILogger>;
    let mockFeatureService: jest.Mocked<IFeatureService>;
    let mockOllamaClient: jest.Mocked<OllamaClient>;
    let mockComfyUiClient: jest.Mocked<ComfyUiClient>;
    let processor: GenerativeAiChannelPostProcessor;

    beforeEach((): void => {
        mockLogger = createMockLogger();
        mockFeatureService = createMockFeatureService(true, true);
        mockOllamaClient = createMockOllamaClient(true);
        mockComfyUiClient = createMockComfyUiClient(true);

        processor = new GenerativeAiChannelPostProcessor(createMockServices(
            mockLogger, mockFeatureService, mockOllamaClient, mockComfyUiClient
        ));
    });

    afterEach((): void => {
        jest.clearAllMocks();
    });

    describe('postProcess()', () => {
        it('should call both free() methods when both feature types are available', async (): Promise<void> => {
            await processor.postProcess();

            expect(mockComfyUiClient.free).toHaveBeenCalledTimes(1);
            expect(mockOllamaClient.free).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should not call ComfyUI free() when no media features available', async (): Promise<void> => {
            const noMedia = createMockFeatureService(true, false);
            processor = new GenerativeAiChannelPostProcessor(createMockServices(
                mockLogger, noMedia, mockOllamaClient, mockComfyUiClient
            ));

            await processor.postProcess();

            expect(mockComfyUiClient.free).not.toHaveBeenCalled();
            expect(mockOllamaClient.free).toHaveBeenCalledTimes(1);
        });

        it('should not call Ollama free() when Txt2Txt feature unavailable', async (): Promise<void> => {
            const noTxt2Txt = createMockFeatureService(false, true);
            processor = new GenerativeAiChannelPostProcessor(createMockServices(
                mockLogger, noTxt2Txt, mockOllamaClient, mockComfyUiClient
            ));

            await processor.postProcess();

            expect(mockComfyUiClient.free).toHaveBeenCalledTimes(1);
            expect(mockOllamaClient.free).not.toHaveBeenCalled();
        });
    });
});