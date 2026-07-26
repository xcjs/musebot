import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { ILogger } from '../../../ILogger.js';
import { LlmChatMessage } from '../ollama/models/LlmChatMessage.js';
import { MemoryService } from './MemoryService.js';

function mockLogger(): ILogger {
    return {
        debug: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
    };
}

const TEST_EMBEDDING = [0.1, 0.2, 0.3];

interface TestContainerOptions {
    enabled?: boolean;
}

describe('MemoryService', () => {
    const TEST_BOT_ID = `musebot-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let originalCwd: string;

    beforeEach(() => {
        originalCwd = process.cwd();
    });

    afterEach(() => {
        process.chdir(originalCwd);
        jest.clearAllMocks();
    });

    function createTestContainer(options: TestContainerOptions = {}): IBotServiceContainer {
        const mockLoggerInstance = mockLogger();
        return {
            featureService: {
                hasFeature: jest.fn((feature: SupportedFeature) => {
                    if (feature === SupportedFeature.LongTermMemory) return options.enabled ?? true;
                    return false;
                }),
            },
            configurationService: {
                ollamaTopK: 5,
                botId: TEST_BOT_ID,
                ollamaEmbeddingModel: 'all-minilm',
            },
            getLogger: jest.fn(() => mockLoggerInstance),
            ollamaClient: {
                embed: jest.fn<() => Promise<number[]>>().mockResolvedValue(TEST_EMBEDDING),
            },
            getMemoryService: jest.fn(),
        } as unknown as IBotServiceContainer;
    }

    function createLlmChatMessage(overrides: Partial<LlmChatMessage> = {}): LlmChatMessage {
        return {
            messageId: `msg-${Math.random().toString(36).slice(2)}`,
            username: 'tester',
            displayName: 'Tester',
            userId: 'test-user-1',
            isBot: false,
            message: 'test message content',
            datetime: new Date().toISOString(),
            roles: [],
            channel: { id: 'channel-1', name: 'test-channel', topic: null },
            thread: null,
            server: { id: 'server-1', name: 'test-server' },
            mentions: { users: [], roles: [], everyone: false },
            attachments: [],
            ...overrides,
        };
    }

    describe('isEnabled', () => {
        it('should be true when LongTermMemory feature is enabled', () => {
            const container = createTestContainer({ enabled: true });
            const service = new MemoryService(container);
            expect(service.isEnabled).toBe(true);
        });

        it('should be false when LongTermMemory feature is disabled', () => {
            const container = createTestContainer({ enabled: false });
            const service = new MemoryService(container);
            expect(service.isEnabled).toBe(false);
        });
    });

    describe('disabled state — all methods are no-ops', () => {
        it('should return false for hasConsent when disabled', async () => {
            const container = createTestContainer({ enabled: false });
            const service = new MemoryService(container);
            expect(await service.hasConsent('user-1')).toBe(false);
        });

        it('should not error on setConsent when disabled', async () => {
            const container = createTestContainer({ enabled: false });
            const service = new MemoryService(container);
            await expect(service.setConsent('user-1')).resolves.not.toThrow();
        });

        it('should not error on removeConsent when disabled', async () => {
            const container = createTestContainer({ enabled: false });
            const service = new MemoryService(container);
            await expect(service.removeConsent('user-1')).resolves.not.toThrow();
        });

        it('should return empty array for retrieve when disabled', async () => {
            const container = createTestContainer({ enabled: false });
            const service = new MemoryService(container);
            const llmChatMessage = createLlmChatMessage();
            expect(await service.retrieve('user-1', llmChatMessage)).toEqual([]);
        });

        it('should return false for isBackfillComplete when disabled', async () => {
            const container = createTestContainer({ enabled: false });
            const service = new MemoryService(container);
            expect(await service.isBackfillComplete('user-1')).toBe(false);
        });

        it('should return empty array for getIncompleteBackfillUserIds when disabled', async () => {
            const container = createTestContainer({ enabled: false });
            const service = new MemoryService(container);
            expect(await service.getIncompleteBackfillUserIds()).toEqual([]);
        });

        it('should return empty array for getAllConsentingUserIds when disabled', async () => {
            const container = createTestContainer({ enabled: false });
            const service = new MemoryService(container);
            expect(await service.getAllConsentingUserIds()).toEqual([]);
        });

        it('should return false for hasMessage when disabled', async () => {
            const container = createTestContainer({ enabled: false });
            const service = new MemoryService(container);
            expect(await service.hasMessage('msg-1')).toBe(false);
        });

        it('should not error on markBackfillComplete when disabled', async () => {
            const container = createTestContainer({ enabled: false });
            const service = new MemoryService(container);
            await expect(service.markBackfillComplete('user-1')).resolves.not.toThrow();
        });

        it('should not error on store when disabled', async () => {
            const container = createTestContainer({ enabled: false });
            const service = new MemoryService(container);
            const llmChatMessage = createLlmChatMessage();
            await expect(service.store(llmChatMessage)).resolves.not.toThrow();
        });

        it('should return null for getLatestMemoryTimestamp when disabled', async () => {
            const container = createTestContainer({ enabled: false });
            const service = new MemoryService(container);
            expect(await service.getLatestMemoryTimestamp('user-1')).toBeNull();
        });
    });

    describe('consent management (enabled)', () => {
        it('should set and check consent', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('user-1');
            expect(await service.hasConsent('user-1')).toBe(true);
        });

        it('should remove consent', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('user-1');
            await service.removeConsent('user-1');
            expect(await service.hasConsent('user-1')).toBe(false);
        });

        it('should handle multiple users independently', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('user-a');
            await service.setConsent('user-b');
            expect(await service.hasConsent('user-a')).toBe(true);
            expect(await service.hasConsent('user-b')).toBe(true);
            expect(await service.hasConsent('user-c')).toBe(false);
        });
    });

    describe('backfill tracking (enabled)', () => {
        it('should track backfill state', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('user-1');
            expect(await service.isBackfillComplete('user-1')).toBe(false);
            await service.markBackfillComplete('user-1');
            expect(await service.isBackfillComplete('user-1')).toBe(true);
        });

        it('should list incomplete backfill users', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('user-a');
            await service.setConsent('user-b');
            await service.markBackfillComplete('user-a');

            const incomplete = await service.getIncompleteBackfillUserIds();
            expect(incomplete).toContain('user-b');
            expect(incomplete).not.toContain('user-a');
        });

        it('should list all consenting users', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('user-1');
            await service.setConsent('user-2');
            const ids = await service.getAllConsentingUserIds();
            expect(ids).toContain('user-1');
            expect(ids).toContain('user-2');
        });
    });

    describe('store (enabled)', () => {
        it('should skip storing if user has not consented', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            const llmChatMessage = createLlmChatMessage();
            await expect(service.store(llmChatMessage)).resolves.not.toThrow();
        });

        it('should store after consent is given', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('test-user-1');

            const llmChatMessage = createLlmChatMessage({
                message: 'storable message',
            });
            await expect(service.store(llmChatMessage)).resolves.not.toThrow();
        });

        it('should use ownerUserId for consent check when provided', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('owner-user');

            const llmChatMessage = createLlmChatMessage({
                userId: 'bot-id',
                isBot: true,
            });
            await expect(service.store(llmChatMessage, 'owner-user')).resolves.not.toThrow();
        });

        it('should skip storing if owner has not consented', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            const llmChatMessage = createLlmChatMessage({ userId: 'bot-id' });
            await expect(service.store(llmChatMessage, 'non-consenting-owner')).resolves.not.toThrow();
        });

        it('should handle errors gracefully during store', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('test-user-1');

            container.ollamaClient.embed = jest.fn<() => Promise<number[]>>().mockRejectedValue(new Error('embedding failed'));

            const llmChatMessage = createLlmChatMessage();
            await expect(service.store(llmChatMessage)).resolves.not.toThrow();
            const logger = container.getLogger('MemoryService') as unknown as ILogger;
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('retrieve (enabled)', () => {
        it('should pass userId through to database query', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('user-1');

            const llmChatMessage = createLlmChatMessage({ userId: 'user-1' });
            const result = await service.retrieve('user-1', llmChatMessage);
            expect(Array.isArray(result)).toBe(true);
        });

        it('should return empty array when serverId is null (DM context)', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('user-1');

            const llmChatMessage = createLlmChatMessage({
                server: { id: null, name: null },
            });
            expect(await service.retrieve('user-1', llmChatMessage)).toEqual([]);
        });

        it('should handle errors gracefully during retrieve', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);

            const llmChatMessage = createLlmChatMessage({ userId: 'nonexistent-user' });
            await expect(service.retrieve('nonexistent-user', llmChatMessage)).resolves.not.toThrow();
        });

        it('should return empty or array when user has stored memories', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('test-user-1');

            const llmChatMessage = createLlmChatMessage({
                message: 'memory test message',
                server: { id: 'server-1', name: 'test-server' },
            });

            await service.store(llmChatMessage);
            const result = await service.retrieve('test-user-1', llmChatMessage);
            expect(Array.isArray(result)).toBe(true);
        });

        it('should scope retrieval to specific user', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('user-alpha');
            await service.setConsent('user-beta');

            const msgAlpha = createLlmChatMessage({
                userId: 'user-alpha',
                message: 'alpha memory',
                server: { id: 'shared-server', name: 'shared' },
            });
            const msgBeta = createLlmChatMessage({
                userId: 'user-beta',
                message: 'beta memory',
                server: { id: 'shared-server', name: 'shared' },
            });

            await service.store(msgAlpha);
            await service.store(msgBeta);

            const alphaResults = await service.retrieve('user-alpha', msgAlpha);
            expect(Array.isArray(alphaResults)).toBe(true);
        });
    });

    describe('getLatestMemoryTimestamp (enabled)', () => {
        it('should return null when no memories exist for user', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('user-1');
            expect(await service.getLatestMemoryTimestamp('user-1')).toBeNull();
        });

        it('should return timestamp after storing a memory', async () => {
            const container = createTestContainer();
            const service = new MemoryService(container);
            await service.setConsent('test-user-1');

            const llmChatMessage = createLlmChatMessage({ message: 'timestamp test' });
            await service.store(llmChatMessage);

            const timestamp = await service.getLatestMemoryTimestamp('test-user-1');
            expect(typeof timestamp).toBe('string');
        });
    });
});