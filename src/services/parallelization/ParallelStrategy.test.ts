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
            const result = strategy.getTaskChannel(ResourceType.Chat, null);
            expect(result).toBe('Chat');
        });

        it('should include URL in channel name when URL is provided', () => {
            const url = new URL('http://localhost:11434');
            const result = strategy.getTaskChannel(ResourceType.Chat, url);
            expect(result).toBe('Chat_http://localhost:11434/');
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

        it('should create unique channels for different URLs with same resource type', () => {
            const url1 = new URL('http://localhost:11434');
            const url2 = new URL('http://localhost:11435');
            
            const result1 = strategy.getTaskChannel(ResourceType.LargeLanguageModel, url1);
            const result2 = strategy.getTaskChannel(ResourceType.LargeLanguageModel, url2);
            
            expect(result1).not.toBe(result2);
            expect(result1).toContain('localhost:11434');
            expect(result2).toContain('localhost:11435');
        });

        it('should handle GenerativeAI resource type', () => {
            const result = strategy.getTaskChannel(ResourceType.GenerativeAI, null);
            expect(result).toBe('GenerativeAI');
        });

        it('should handle Chat resource type with URL', () => {
            const url = new URL('http://example.com');
            const result = strategy.getTaskChannel(ResourceType.Chat, url);
            expect(result).toContain('Chat');
            expect(result).toContain('example.com');
        });
    });
});