import { beforeEach, describe, expect, it } from '@jest/globals';

import { createMockServiceContainer } from '../../test-utils/mockServiceContainer.js';
import type { IEnvironmentSettings } from '../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../IServiceContainer.js';
import { ResourceType } from './ResourceType.js';
import { SerialStrategy } from './SerialStrategy.js';

describe('SerialStrategy', () => {
    let strategy: SerialStrategy;
    let services: IServiceContainer;

    beforeEach(() => {
        const environmentSettings = {
            maxTaskAttempts: 3,
            taskRetryDelayMilliseconds: 100,
            taskQueueForceSerialAcrossHosts: true,
        } as IEnvironmentSettings;
        services = createMockServiceContainer({ environmentSettings });
        strategy = new SerialStrategy(services);
    });

    describe('getTaskChannel()', () => {
        it('should return resource type only when URL is null', () => {
            const result = strategy.getTaskChannel(ResourceType.Chat, false, null);
            expect(result).toBe('Chat');
        });

        it('should NOT include hostname in channel name when URL is provided and taskQueueForceSerialAcrossHosts is true', () => {
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: true,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const testStrategy = new SerialStrategy(testServices);
            const url = new URL('http://localhost:11434');
            const result = testStrategy.getTaskChannel(ResourceType.Chat, false, url);
            expect(result).toBe('Chat');
        });

        it('should NOT include hostname in channel name when URL is provided and taskQueueForceSerialAcrossHosts is true', () => {
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: true,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const testStrategy = new SerialStrategy(testServices);
            const url = new URL('http://localhost:11434');
            const result = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, false, url);
            expect(result).toBe('GenerativeAI');
        });

        it('should NOT include hostname in channel name when URL is provided and taskQueueForceSerialAcrossHosts is true', () => {
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: true,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const testStrategy = new SerialStrategy(testServices);
            const url = new URL('http://localhost:8188');
            const result = testStrategy.getTaskChannel(ResourceType.Media, false, url);
            expect(result).toBe('GenerativeAI');
        });

        it('should convert LargeLanguageModel to GenerativeAI', () => {
            const result = strategy.getTaskChannel(ResourceType.LargeLanguageModel, false, null);
            expect(result).toBe('GenerativeAI');
        });

        it('should convert Media to GenerativeAI', () => {
            const result = strategy.getTaskChannel(ResourceType.Media, false, null);
            expect(result).toBe('GenerativeAI');
        });

        it('should not convert Chat resource type', () => {
            const result = strategy.getTaskChannel(ResourceType.Chat, false, null);
            expect(result).toBe('Chat');
        });

        it('should not convert None resource type', () => {
            const result = strategy.getTaskChannel(ResourceType.None, false, null);
            expect(result).toBe('none');
        });

        it('should convert LargeLanguageModel with URL to GenerativeAI (no hostname included)', () => {
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: true,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const testStrategy = new SerialStrategy(testServices);
            const url = new URL('http://localhost:11434');
            const result = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, false, url);
            expect(result).toBe('GenerativeAI');
        });

        it('should convert Media with URL to GenerativeAI (no hostname included)', () => {
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: true,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const testStrategy = new SerialStrategy(testServices);
            const url = new URL('http://localhost:8188');
            const result = testStrategy.getTaskChannel(ResourceType.Media, false, url);
            expect(result).toBe('GenerativeAI');
        });

        it('should merge LLM and Media into same channel when no URL', () => {
            const llmResult = strategy.getTaskChannel(ResourceType.LargeLanguageModel, false, null);
            const mediaResult = strategy.getTaskChannel(ResourceType.Media, false, null);

            expect(llmResult).toBe(mediaResult);
            expect(llmResult).toBe('GenerativeAI');
        });

        it('should create SAME channel for different URLs when taskQueueForceSerialAcrossHosts is true', () => {
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: true,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const testStrategy = new SerialStrategy(testServices);
            const url1 = new URL('http://localhost:11434');
            const url2 = new URL('http://otherhost:11435');
            const result1 = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, false, url1);
            const result2 = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, false, url2);

            expect(result1).toBe(result2);
        });

        it('should handle GenerativeAI resource type without conversion', () => {
            const result = strategy.getTaskChannel(ResourceType.GenerativeAI, false, null);
            expect(result).toBe('GenerativeAI');
        });

        it('should NOT include URL for GenerativeAI when provided', () => {
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: true,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const testStrategy = new SerialStrategy(testServices);
            const url = new URL('http://localhost:3000');
            const result = testStrategy.getTaskChannel(ResourceType.GenerativeAI, false, url);
            expect(result).toBe('GenerativeAI');
        });
    });
});
