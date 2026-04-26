import { beforeEach, describe, expect, it } from '@jest/globals';

import { ParallelStrategy } from './ParallelStrategy.js';
import { ResourceType } from './ResourceType.js';

describe('ParallelStrategy', () => {
    let strategy: ParallelStrategy;

    beforeEach(() => {
        strategy = new ParallelStrategy();
    });

    describe('getTaskChannel()', () => {
        it('should return resource type only when URL is null', () => {
            const result = strategy.getTaskChannel(ResourceType.Chat, false, null);
            expect(result).toBe('Chat');
        });

        it('should include hostname in channel name when URL is provided and taskQueueForceSerialAcrossHosts is false', () => {
            const testStrategy = new ParallelStrategy();
            const url = new URL('http://localhost:11434');
            const result = testStrategy.getTaskChannel(ResourceType.Chat, false, url);
            expect(result).toBe('Chat_localhost');
        });

        it('should not modify LargeLanguageModel resource type', () => {
            const result = strategy.getTaskChannel(ResourceType.LargeLanguageModel, false, null);
            expect(result).toBe('LargeLanguageModel');
        });

        it('should not modify Media resource type', () => {
            const result = strategy.getTaskChannel(ResourceType.Media, false, null);
            expect(result).toBe('Media');
        });

        it('should handle None resource type', () => {
            const result = strategy.getTaskChannel(ResourceType.None, false, null);
            expect(result).toBe('none');
        });

        it('should include hostname when taskQueueForceSerialAcrossHosts is true', () => {
            const testStrategy = new ParallelStrategy();
            const url1 = new URL('http://localhost:11434');
            const url2 = new URL('http://otherhost:11435');
            const result1 = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, false, url1);
            const result2 = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, false, url2);

            expect(result1).not.toBe(result2);
            expect(result1).toContain('localhost');
            expect(result2).toContain('otherhost');
        });

        it('should handle GenerativeAI resource type', () => {
            const result = strategy.getTaskChannel(ResourceType.GenerativeAI, false, null);
            expect(result).toBe('GenerativeAI');
        });

        it('should handle Chat resource type with URL', () => {
            const url = new URL('http://example.com');
            const result = strategy.getTaskChannel(ResourceType.Chat, false, url);
            expect(result).toContain('Chat');
        });

        it('should include Child suffix for child tasks', () => {
            const url = new URL('http://localhost:11434');
            const result = strategy.getTaskChannel(ResourceType.Chat, true, url);
            expect(result).toBe('Chat_Child_localhost');
        });
    });

    describe('comparison with SerialStrategy', () => {
        it('should keep LLM and Media separate in ParallelStrategy', () => {
            const llmChannel = strategy.getTaskChannel(ResourceType.LargeLanguageModel, false, null);
            const mediaChannel = strategy.getTaskChannel(ResourceType.Media, false, null);

            expect(llmChannel).not.toBe(mediaChannel);
        });

        it('should use different URLs for same resource when taskQueueForceSerialAcrossHosts is false', () => {
            const testStrategy = new ParallelStrategy();
            const url1 = new URL('http://localhost:11434');
            const url2 = new URL('http://otherhost:11435');
            const result1 = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, false, url1);
            const result2 = testStrategy.getTaskChannel(ResourceType.LargeLanguageModel, false, url2);

            expect(result1).not.toBe(result2);
        });

        it('should handle Chat the same way in both strategies', () => {
            const parallel = new ParallelStrategy();
            const serial = new ParallelStrategy();

            const parallelResult = parallel.getTaskChannel(ResourceType.Chat, false, null);
            const serialResult = serial.getTaskChannel(ResourceType.Chat, false, null);

            expect(parallelResult).toBe(serialResult);
        });

        it('should handle None the same way in both strategies', () => {
            const parallel = new ParallelStrategy();
            const serial = new ParallelStrategy();

            const parallelResult = parallel.getTaskChannel(ResourceType.None, false, null);
            const serialResult = serial.getTaskChannel(ResourceType.None, false, null);

            expect(parallelResult).toBe(serialResult);
        });
    });
});