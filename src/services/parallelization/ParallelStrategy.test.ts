import { beforeEach, describe, expect, it } from '@jest/globals';

import type { IEnvironmentSettings } from '../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../IServiceContainer.js';
import { ParallelStrategy } from './ParallelStrategy.js';
import { SerialStrategy } from './SerialStrategy.js';
import { ResourceType } from './ResourceType.js';
import { createMockServiceContainer } from '../../test-utils/mockServiceContainer.js';

describe('ParallelStrategy', () => {
    let strategy: ParallelStrategy;
    let services: IServiceContainer;

    beforeEach(() => {
        const environmentSettings = {
            maxTaskAttempts: 3,
            taskRetryDelayMilliseconds: 100,
            taskQueueForceSerialAcrossHosts: false,
        } as IEnvironmentSettings;
        services = createMockServiceContainer({ environmentSettings });
        strategy = new ParallelStrategy(services);
    });

    describe('getTaskChannel()', () => {
        it('should return resource type only when URL is null', () => {
            const result = strategy.getTaskChannel(ResourceType.Chat, null);
            expect(result).toBe('Chat');
        });

        it('should include hostname in channel name when URL is provided and taskQueueForceSerialAcrossHosts is false', () => {
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: false,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const testStrategy = new ParallelStrategy(testServices);
            const url = new URL('http://localhost:11434');
            const result = testStrategy.getTaskChannel(ResourceType.Chat, url);
            expect(result).toBe('Chat');
        });

        it('should not modify LargeLanguageModel resource type', () => {
            const result = strategy.getTaskChannel(ResourceType.LargeLanguageModel, null);
            expect(result).toBe('LargeLanguageModel');
        });

        it('should not modify Media resource type', () => {
            const result = strategy.getTaskChannel(ResourceType.Media, null);
            expect(result).toBe('Media');
        });

        it('should handle None resource type', () => {
            const result = strategy.getTaskChannel(ResourceType.None, null);
            expect(result).toBe('none');
        });

        it('should include hostname when taskQueueForceSerialAcrossHosts is true', () => {
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: true,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const testStrategy = new ParallelStrategy(testServices);
            const url1 = new URL('http://localhost:11434');
            const url2 = new URL('http://otherhost:11435');
            const result1 = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, url1);
            const result2 = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, url2);

            expect(result1).not.toBe(result2);
            expect(result1).toContain('localhost');
            expect(result2).toContain('otherhost');
        });

        it('should handle GenerativeAI resource type', () => {
            const result = strategy.getTaskChannel(ResourceType.GenerativeAI, null);
            expect(result).toBe('GenerativeAI');
        });

        it('should handle Chat resource type with URL', () => {
            const url = new URL('http://example.com');
            const result = strategy.getTaskChannel(ResourceType.Chat, url);
            expect(result).toContain('Chat');
        });
    });

    describe('comparison with SerialStrategy', () => {
        it('should keep LLM and Media separate in ParallelStrategy', () => {
            const llmChannel = strategy.getTaskChannel(ResourceType.LargeLanguageModel, null);
            const mediaChannel = strategy.getTaskChannel(ResourceType.Media, null);

            expect(llmChannel).not.toBe(mediaChannel);
        });

        it('should use different URLs for same resource when taskQueueForceSerialAcrossHosts is false', () => {
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: false,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const testStrategy = new ParallelStrategy(testServices);
            const url1 = new URL('http://localhost:11434');
            const url2 = new URL('http://otherhost:11435');
            const result1 = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, url1);
            const result2 = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, url2);

            expect(result1).toBe(result2);
        });

        it('should merge LLM and Media into same channel in SerialStrategy', () => {
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: true,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const testStrategy = new SerialStrategy(testServices);
            const llmChannel = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, null);
            const mediaChannel = testStrategy.getTaskChannel(ResourceType.Media, null);

            expect(llmChannel).toBe(mediaChannel);
        });

        it('should handle Chat the same way in both strategies', () => {
            const parallel = new ParallelStrategy(services);
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: false,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const serial = new ParallelStrategy(testServices);

            const parallelResult = parallel.getTaskChannel(ResourceType.Chat, null);
            const serialResult = serial.getTaskChannel(ResourceType.Chat, null);

            expect(parallelResult).toBe(serialResult);
        });

        it('should handle None the same way in both strategies', () => {
            const parallel = new ParallelStrategy(services);
            const environmentSettings = {
                maxTaskAttempts: 3,
                taskRetryDelayMilliseconds: 100,
                taskQueueForceSerialAcrossHosts: false,
            } as IEnvironmentSettings;
            const testServices = createMockServiceContainer({ environmentSettings });
            const serial = new ParallelStrategy(testServices);

            const parallelResult = parallel.getTaskChannel(ResourceType.None, null);
            const serialResult = serial.getTaskChannel(ResourceType.None, null);

            expect(parallelResult).toBe(serialResult);
        });
    });
});