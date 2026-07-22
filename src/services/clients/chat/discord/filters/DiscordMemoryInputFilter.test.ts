import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { DiscordMemoryInputFilter } from './DiscordMemoryInputFilter.js';

function createMockMemoryService(options: { enabled?: boolean; memories?: any[] } = {}): any {
    return {
        isEnabled: options.enabled ?? true,
        retrieve: jest.fn(async () => options.memories ?? []),
    };
}

function createMockContainer(memoryService: any): any {
    return {
        getMemoryService: jest.fn(() => memoryService),
    };
}

function createLlmChatMessage(overrides: Partial<any> = {}): any {
    return {
        userId: 'user-123',
        messageId: 'msg-456',
        server: { id: 'server-789' },
        channel: { id: 'channel-abc' },
        message: 'test message',
        isBot: false,
        ...overrides,
    };
}

function createContext(messages: any[] = []): any[] {
    return messages;
}

describe('DiscordMemoryInputFilter', () => {
    describe('when memory service is disabled', () => {
        it('should return original context unchanged', async () => {
            const mockMemoryService = createMockMemoryService({ enabled: false });
            const container = createMockContainer(mockMemoryService);
            const filter = new DiscordMemoryInputFilter(container);

            const llmChatMessage = createLlmChatMessage();
            const context = createContext([
                { role: 'system', content: 'original system message' },
                { role: 'user', content: 'user prompt' },
            ]);

            const result = await filter.process(llmChatMessage, {} as any, context);

            expect(result).toBe(context);
            expect(mockMemoryService.retrieve).not.toHaveBeenCalled();
        });
    });

    describe('when memory service is enabled but retrieve returns empty', () => {
        it('should return original context unchanged', async () => {
            const mockMemoryService = createMockMemoryService({ enabled: true, memories: [] });
            const container = createMockContainer(mockMemoryService);
            const filter = new DiscordMemoryInputFilter(container);

            const llmChatMessage = createLlmChatMessage();
            const context = createContext([
                { role: 'user', content: 'what is 2+2?' },
            ]);

            const result = await filter.process(llmChatMessage, {} as any, context);

            expect(result).toBe(context);
            expect(mockMemoryService.retrieve).toHaveBeenCalledWith('user-123', llmChatMessage);
        });
    });

    describe('when memory service returns memories', () => {
        it('should prepend memories before original context', async () => {
            const memories = [
                { role: 'system', content: 'Relevant memory 1' },
                { role: 'system', content: 'Relevant memory 2' },
            ];

            const mockMemoryService = createMockMemoryService({ enabled: true, memories });
            const container = createMockContainer(mockMemoryService);
            const filter = new DiscordMemoryInputFilter(container);

            const llmChatMessage = createLlmChatMessage();
            const context = createContext([
                { role: 'system', content: 'system prompt' },
                { role: 'user', content: 'current user message' },
            ]);

            const result = await filter.process(llmChatMessage, {} as any, context);

            expect(result).toEqual([
                ...memories,
                ...context,
            ]);

            // Verify it's a new array (not mutating original)
            expect(result).not.toBe(context);
        });

        it('should pass userId correctly to retrieve', async () => {
            const mockMemoryService = createMockMemoryService({ enabled: true, memories: [] });
            const container = createMockContainer(mockMemoryService);
            const filter = new DiscordMemoryInputFilter(container);

            const llmChatMessage = createLlmChatMessage({ userId: 'special-user-999' });
            await filter.process(llmChatMessage, {} as any, []);

            expect(mockMemoryService.retrieve).toHaveBeenCalledWith('special-user-999', llmChatMessage);
        });

        it('should preserve memory and context order', async () => {
            const memories = [
                { role: 'system', content: 'memory A' },
                { role: 'system', content: 'memory B' },
            ];

            const mockMemoryService = createMockMemoryService({ enabled: true, memories });
            const container = createMockContainer(mockMemoryService);
            const filter = new DiscordMemoryInputFilter(container);

            const llmChatMessage = createLlmChatMessage();
            const context = createContext([
                { role: 'system', content: 'system 1' },
                { role: 'user', content: 'prompt' },
                { role: 'assistant', content: 'response' },
            ]);

            const result = await filter.process(llmChatMessage, {} as any, context);

            expect(result).toHaveLength(5);
            expect(result[0].content).toBe('memory A');
            expect(result[1].content).toBe('memory B');
            expect(result[2].content).toBe('system 1');
            expect(result[3].content).toBe('prompt');
            expect(result[4].content).toBe('response');
        });

        it('should work with empty context', async () => {
            const memories = [
                { role: 'system', content: 'only memory' },
            ];

            const mockMemoryService = createMockMemoryService({ enabled: true, memories });
            const container = createMockContainer(mockMemoryService);
            const filter = new DiscordMemoryInputFilter(container);

            const llmChatMessage = createLlmChatMessage();
            const result = await filter.process(llmChatMessage, {} as any, []);

            expect(result).toEqual(memories);
        });
    });
});
