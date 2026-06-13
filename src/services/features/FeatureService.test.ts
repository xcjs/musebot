import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createMockLogger, createMockServiceContainer } from '../../test-utils/mockBotServiceContainer.js';
import type { IWorkflowService } from '../clients/media/comfy-ui/services/IWorkflowService.js';
import type { IConfigurationService } from '../environment-settings/IConfigurationService.js';
import type { IBotServiceContainer } from '../IBotServiceContainer.js';
import { SupportedFeature } from './enum/SupportedFeature.js';
import { FeatureService } from './FeatureService.js';

function createMockConfigurationService(overrides: Partial<IConfigurationService> = {}): IConfigurationService {
    return {
        packageName: 'musebot',
        version: '1.0.0',
        nodeEnvironment: 'test' as never,
        botId: 'test-bot',
        botFunction: 'chat' as never,
        discordToken: 'test-token',
        discordChannels: [],
        discordChannelsDisallowed: [],
        botRequiresMention: false,
        botResponseRate: 100,
        botPrivateMessageUsers: [],
        errorMessage: 'error',
        maxTaskAttempts: 3,
        taskRetryDelayMilliseconds: 100,
        taskQueueStrategy: 'serial' as never,
        taskQueueForceSerialAcrossHosts: false,
        comfyUiHosts: [],
        comfyUiGuidanceScaleInterval: 0.5,
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

describe('FeatureService', () => {
    let mockConfigurationService: IConfigurationService;
    let mockLoadWorkflows: jest.Mock<() => Promise<void>>;
    let mockHasWorkflowType: jest.Mock<(feature: SupportedFeature) => boolean>;
    let mockWorkflowService: IWorkflowService;
    let mockContainer: IBotServiceContainer;
    let service: FeatureService;

    beforeEach((): void => {
        mockConfigurationService = createMockConfigurationService();

        mockLoadWorkflows = jest.fn((): Promise<void> => Promise.resolve());
        mockHasWorkflowType = jest.fn((): boolean => false);

        mockWorkflowService = {
            loadWorkflows: mockLoadWorkflows,
            hasWorkflows: false,
            hasWorkflowType: mockHasWorkflowType,
        } as unknown as IWorkflowService;

        mockContainer = {
            ...createMockServiceContainer(),
            configurationService: mockConfigurationService,
            workflowService: mockWorkflowService,
        };

        service = new FeatureService(mockContainer);
    });

    describe('constructor', () => {
        it('should initialize with empty supported features', (): void => {
            expect(service.supportedFeatures).toEqual([]);
        });
    });

    describe('hasFeature()', () => {
        it('should return false when feature is not supported', (): void => {
            expect(service.hasFeature(SupportedFeature.Txt2Img)).toBe(false);
        });

        it('should return true when feature is supported', async (): Promise<void> => {
            mockConfigurationService.ollamaHosts = [new URL('http://localhost:11434')];
            mockConfigurationService.ollamaModels = ['llama3'];

            await service.loadFeatures();

            expect(service.hasFeature(SupportedFeature.Txt2Txt)).toBe(true);
        });
    });

    describe('loadFeatures()', () => {
        it('should call workflowService.loadWorkflows', async function (this: void): Promise<void> {
            await service.loadFeatures();

            expect(mockLoadWorkflows).toHaveBeenCalledTimes(1);
        });

        it('should add Txt2Txt when ollamaHosts and ollamaModels are configured', async function (this: void): Promise<void> {
            mockConfigurationService.ollamaHosts = [new URL('http://localhost:11434')];
            mockConfigurationService.ollamaModels = ['llama3'];

            await service.loadFeatures();

            expect(service.supportedFeatures).toContain(SupportedFeature.Txt2Txt);
        });

        it('should not add Txt2Txt when ollamaHosts is empty', async function (this: void): Promise<void> {
            mockConfigurationService.ollamaHosts = [];
            mockConfigurationService.ollamaModels = ['llama3'];

            await service.loadFeatures();

            expect(service.supportedFeatures).not.toContain(SupportedFeature.Txt2Txt);
        });

        it('should not add Txt2Txt when ollamaModels is empty', async function (this: void): Promise<void> {
            mockConfigurationService.ollamaHosts = [new URL('http://localhost:11434')];
            mockConfigurationService.ollamaModels = [];

            await service.loadFeatures();

            expect(service.supportedFeatures).not.toContain(SupportedFeature.Txt2Txt);
        });

        it('should return early when workflowService has no workflows', async function (this: void): Promise<void> {
            mockConfigurationService.ollamaHosts = [new URL('http://localhost:11434')];
            mockConfigurationService.ollamaModels = ['llama3'];
            mockWorkflowService.hasWorkflows = false;

            await service.loadFeatures();

            expect(mockConfigurationService.comfyUiHosts).toEqual([]);
            expect(mockHasWorkflowType).not.toHaveBeenCalled();
        });

        it('should add workflow features when comfyUiHosts and workflows are configured', async function (this: void): Promise<void> {
            mockConfigurationService.comfyUiHosts = [new URL('http://localhost:8188')];
            mockWorkflowService.hasWorkflows = true;
            mockHasWorkflowType.mockImplementation((feature: SupportedFeature): boolean => {
                return feature === SupportedFeature.Txt2Img || feature === SupportedFeature.Txt2Vid;
            });

            await service.loadFeatures();

            expect(service.supportedFeatures).toContain(SupportedFeature.Txt2Img);
            expect(service.supportedFeatures).toContain(SupportedFeature.Txt2Vid);
            expect(service.supportedFeatures).not.toContain(SupportedFeature.Txt2Music);
        });

        it('should not add workflow features when comfyUiHosts is empty', async function (this: void): Promise<void> {
            mockConfigurationService.comfyUiHosts = [];
            mockWorkflowService.hasWorkflows = true;

            await service.loadFeatures();

            expect(mockHasWorkflowType).not.toHaveBeenCalled();
        });

        it('should add both Txt2Txt and workflow features together', async function (this: void): Promise<void> {
            mockConfigurationService.ollamaHosts = [new URL('http://localhost:11434')];
            mockConfigurationService.ollamaModels = ['llama3'];
            mockConfigurationService.comfyUiHosts = [new URL('http://localhost:8188')];
            mockWorkflowService.hasWorkflows = true;
            mockHasWorkflowType.mockImplementation((feature: SupportedFeature): boolean => {
                return feature === SupportedFeature.Txt2Img;
            });

            await service.loadFeatures();

            expect(service.supportedFeatures).toContain(SupportedFeature.Txt2Txt);
            expect(service.supportedFeatures).toContain(SupportedFeature.Txt2Img);
            expect(service.supportedFeatures.length).toBe(2);
        });

        it('should add no features when nothing is configured', async function (this: void): Promise<void> {
            await service.loadFeatures();

            expect(service.supportedFeatures).toEqual([]);
        });

        it('should log info for Txt2Txt when supported', async function (this: void): Promise<void> {
            const logger = createMockLogger();
            mockContainer = {
                ...createMockServiceContainer({ logger }),
                configurationService: mockConfigurationService,
                workflowService: mockWorkflowService,
            };
            service = new FeatureService(mockContainer);

            mockConfigurationService.ollamaHosts = [new URL('http://localhost:11434')];
            mockConfigurationService.ollamaModels = ['llama3'];

            await service.loadFeatures();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(logger.info).toHaveBeenCalledWith(`${SupportedFeature.Txt2Txt} supported.`);
        });

        it('should log info for each supported workflow feature', async function (this: void): Promise<void> {
            const logger = createMockLogger();
            mockContainer = {
                ...createMockServiceContainer({ logger }),
                configurationService: mockConfigurationService,
                workflowService: mockWorkflowService,
            };
            service = new FeatureService(mockContainer);

            mockConfigurationService.comfyUiHosts = [new URL('http://localhost:8188')];
            mockWorkflowService.hasWorkflows = true;
            mockHasWorkflowType.mockImplementation((feature: SupportedFeature): boolean => {
                return feature === SupportedFeature.Txt2Img;
            });

            await service.loadFeatures();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(logger.info).toHaveBeenCalledWith(`${SupportedFeature.Txt2Img} supported.`);
        });
    });
});
