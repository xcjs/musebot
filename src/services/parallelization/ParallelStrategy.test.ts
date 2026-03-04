import { beforeEach, describe, expect, it } from '@jest/globals';

import { IParallelizationStrategy } from './IParallelizationStrategy.js';
import { ParallelStrategy } from './ParallelStrategy.js';
import { ResourceType } from './ResourceType.js';
import { SerialStrategy } from './SerialStrategy.js';

describe('parallelization', () => {
    describe('ParallelStrategy', () => {
        let strategy: IParallelizationStrategy;

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
        });
    });

    describe('SerialStrategy', () => {
        let strategy: IParallelizationStrategy;

        beforeEach(() => {
            strategy = new SerialStrategy();
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

            it('should convert LargeLanguageModel to GenerativeAI', () => {
                const result = strategy.getTaskChannel(ResourceType.LargeLanguageModel, null);
                expect(result).toBe('GenerativeAI');
            });

            it('should convert Media to GenerativeAI', () => {
                const result = strategy.getTaskChannel(ResourceType.Media, null);
                expect(result).toBe('GenerativeAI');
            });

            it('should not convert Chat resource type', () => {
                const result = strategy.getTaskChannel(ResourceType.Chat, null);
                expect(result).toBe('Chat');
            });

            it('should not convert None resource type', () => {
                const result = strategy.getTaskChannel(ResourceType.None, null);
                expect(result).toBe('none');
            });

            it('should convert LargeLanguageModel with URL to GenerativeAI', () => {
                const url = new URL('http://localhost:11434');
                const result = strategy.getTaskChannel(ResourceType.LargeLanguageModel, url);
                expect(result).toBe('GenerativeAI_http://localhost:11434/');
            });

            it('should convert Media with URL to GenerativeAI', () => {
                const url = new URL('http://localhost:8188');
                const result = strategy.getTaskChannel(ResourceType.Media, url);
                expect(result).toBe('GenerativeAI_http://localhost:8188/');
            });

            it('should merge LLM and Media into same channel when no URL', () => {
                const llmResult = strategy.getTaskChannel(ResourceType.LargeLanguageModel, null);
                const mediaResult = strategy.getTaskChannel(ResourceType.Media, null);
                
                expect(llmResult).toBe(mediaResult);
                expect(llmResult).toBe('GenerativeAI');
            });

            it('should create different channels for different URLs even with converted type', () => {
                const url1 = new URL('http://localhost:11434');
                const url2 = new URL('http://localhost:11435');
                
                const result1 = strategy.getTaskChannel(ResourceType.LargeLanguageModel, url1);
                const result2 = strategy.getTaskChannel(ResourceType.LargeLanguageModel, url2);
                
                expect(result1).not.toBe(result2);
            });
        });
    });

    describe('Strategy comparison', () => {
        it('ParallelStrategy should keep LLM and Media separate', () => {
            const parallel = new ParallelStrategy();
            
            const llmChannel = parallel.getTaskChannel(ResourceType.LargeLanguageModel, null);
            const mediaChannel = parallel.getTaskChannel(ResourceType.Media, null);
            
            expect(llmChannel).not.toBe(mediaChannel);
        });

        it('SerialStrategy should merge LLM and Media into same channel', () => {
            const serial = new SerialStrategy();
            
            const llmChannel = serial.getTaskChannel(ResourceType.LargeLanguageModel, null);
            const mediaChannel = serial.getTaskChannel(ResourceType.Media, null);
            
            expect(llmChannel).toBe(mediaChannel);
        });

        it('Both strategies should handle Chat the same way', () => {
            const parallel = new ParallelStrategy();
            const serial = new SerialStrategy();
            
            const parallelResult = parallel.getTaskChannel(ResourceType.Chat, null);
            const serialResult = serial.getTaskChannel(ResourceType.Chat, null);
            
            expect(parallelResult).toBe(serialResult);
        });
    });
});
