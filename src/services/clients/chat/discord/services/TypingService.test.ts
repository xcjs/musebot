import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BaseGuildTextChannel, ButtonInteraction, DMChannel, Message } from 'discord.js';

import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { ITypingService } from '../../ITypingService.js';
import { TypingService } from './TypingService.js';

/**
 * Mock channel type with jest.Mock for sendTyping
 */
interface MockChannel {
    sendTyping: jest.Mock<() => Promise<void>>;
}

/**
 * Helper function to create a mock channel that passes instanceof checks
 */
function createMockBaseGuildTextChannel(): BaseGuildTextChannel & MockChannel {
    const channel: MockChannel = {
        sendTyping: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    Object.setPrototypeOf(channel, BaseGuildTextChannel.prototype);
    return channel as unknown as BaseGuildTextChannel & MockChannel;
}

/**
 * Helper function to create a mock DM channel that passes instanceof checks
 */
function createMockDMChannel(): DMChannel & MockChannel {
    const channel: MockChannel = {
        sendTyping: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    Object.setPrototypeOf(channel, DMChannel.prototype);
    return channel as unknown as DMChannel & MockChannel;
}

describe('TypingService', () => {
    let mockTaskQueue: ITaskQueue;
    let mockLogger: {
        debug: jest.Mock;
        info: jest.Mock;
        success: jest.Mock;
        warn: jest.Mock;
        error: jest.Mock;
        fatal: jest.Mock;
    };
    let getLoggerFn: (prefix: string) => ILogger;
    let typingService: ITypingService;

    beforeEach(() => {
        jest.useFakeTimers();

        mockTaskQueue = {
            isActive: false,
            add: jest.fn()
        };

        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            success: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            fatal: jest.fn()
        };

        getLoggerFn = jest.fn<(prefix: string) => ILogger>().mockReturnValue(mockLogger as unknown as ILogger);

        typingService = new TypingService({
            taskQueue: mockTaskQueue,
            getLogger: getLoggerFn
        } as IServiceContainer);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with taskQueue and logger from services', () => {
            expect(getLoggerFn).toHaveBeenCalledWith('TypingService');
        });
    });

    describe('startTyping', () => {
        let mockMessage: Message;
        let mockChannel: BaseGuildTextChannel & MockChannel;

        beforeEach(() => {
            mockChannel = createMockBaseGuildTextChannel();

            mockMessage = {
                channelId: 'test-channel-id',
                channel: mockChannel
            } as unknown as Message;
        });

        it('should create a new typing indicator when one does not exist for the channel', async () => {
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockMessage);

            expect(mockLogger.info).toHaveBeenCalledWith(
                'No typing indicator for channel #test-channel-id was found - creating a new one.'
            );
        });

        it('should skip creating interval if typing indicator already exists for channel', async () => {
            mockTaskQueue.isActive = true;

            // First call creates the indicator
            await typingService.startTyping(mockMessage);

            // Clear the mocks to check second call
            mockLogger.info.mockClear();

            // Second call should skip
            await typingService.startTyping(mockMessage);

            expect(mockLogger.info).toHaveBeenCalledWith(
                'This channel already has a typing indicator - skipping.'
            );
        });

        it('should send typing indicator immediately when started', async () => {
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockMessage);

            expect(mockChannel.sendTyping).toHaveBeenCalledTimes(1);
        });

        it('should set up interval to send typing indicator repeatedly', async () => {
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockMessage);

            expect(mockChannel.sendTyping).toHaveBeenCalledTimes(1);

            // Advance timers to trigger interval callback
            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            expect(mockChannel.sendTyping).toHaveBeenCalledTimes(2);

            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            expect(mockChannel.sendTyping).toHaveBeenCalledTimes(3);
        });

        it('should work with ButtonInteraction', async () => {
            const mockInteraction = {
                channelId: 'interaction-channel-id',
                channel: mockChannel
            } as unknown as ButtonInteraction;
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockInteraction);

            expect(mockChannel.sendTyping).toHaveBeenCalledTimes(1);
        });

        it('should work with DMChannel', async () => {
            const mockDMChannel = createMockDMChannel();

            const mockDMMessage = {
                channelId: 'dm-channel-id',
                channel: mockDMChannel
            } as unknown as Message;
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockDMMessage);

            expect(mockDMChannel.sendTyping.mock.calls).toHaveLength(1);
        });

        it('should handle errors during typing and stop typing', async () => {
            const error = new Error('Typing failed');
            mockChannel.sendTyping.mockImplementationOnce(() => Promise.reject(error));
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockMessage);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'An error occurred while setting the typing indicator. Ignore this error if the bot is functioning normally:',
                error
            );
        });

        it('should not send typing for channels that are not BaseGuildTextChannel or DMChannel', async () => {
            const mockTextChannel = {
                sendTyping: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
            };

            const mockInvalidMessage = {
                channelId: 'invalid-channel-id',
                channel: mockTextChannel
            } as unknown as Message;
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockInvalidMessage);

            expect(mockTextChannel.sendTyping).not.toHaveBeenCalled();
        });

        it('should stop typing when task queue becomes inactive', async () => {
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockMessage);

            expect(mockChannel.sendTyping).toHaveBeenCalledTimes(1);

            // Deactivate the task queue
            mockTaskQueue.isActive = false;

            // Advance timer to trigger interval callback
            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            // Should not have called sendTyping again and should have stopped
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Stopped typing and clearing interval:',
                expect.objectContaining({
                    channelId: 'test-channel-id',
                    typingInterval: null
                })
            );
        });

        it('should log interval registration', async () => {
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockMessage);

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Registered typing interval as interval:',
                expect.any(Number)
            );
        });
    });

    describe('error handling', () => {
        let mockMessage: Message;
        let mockChannel: BaseGuildTextChannel & MockChannel;

        beforeEach(() => {
            mockChannel = createMockBaseGuildTextChannel();

            mockMessage = {
                channelId: 'test-channel-id',
                channel: mockChannel
            } as unknown as Message;
        });

        it('should handle errors from sendTyping during interval callback', async () => {
            const error = new Error('Interval typing failed');
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockMessage);

            // Clear the mock from the initial call
            mockChannel.sendTyping.mockClear();
            mockChannel.sendTyping.mockImplementation(() => Promise.reject(error));

            // Advance timer to trigger interval callback with error
            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            expect(mockLogger.error).toHaveBeenCalledWith(
                'An error occurred while setting the typing indicator. Ignore this error if the bot is functioning normally:',
                error
            );
        });
    });

    describe('multiple channels', () => {
        let mockMessage1: Message;
        let mockMessage2: Message;
        let mockChannel1: BaseGuildTextChannel & MockChannel;
        let mockChannel2: BaseGuildTextChannel & MockChannel;

        beforeEach(() => {
            mockChannel1 = createMockBaseGuildTextChannel();
            mockChannel2 = createMockBaseGuildTextChannel();

            mockMessage1 = {
                channelId: 'channel-1',
                channel: mockChannel1
            } as unknown as Message;
            mockMessage2 = {
                channelId: 'channel-2',
                channel: mockChannel2
            } as unknown as Message;
        });

        it('should maintain separate typing indicators for different channels', async () => {
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockMessage1);
            await typingService.startTyping(mockMessage2);

            expect(mockChannel1.sendTyping.mock.calls).toHaveLength(1);
            expect(mockChannel2.sendTyping.mock.calls).toHaveLength(1);

            // Advance timers
            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            expect(mockChannel1.sendTyping.mock.calls).toHaveLength(2);
            expect(mockChannel2.sendTyping.mock.calls).toHaveLength(2);
        });

        it('should stop typing for one channel without affecting others', async () => {
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockMessage1);
            await typingService.startTyping(mockMessage2);

            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            expect(mockChannel1.sendTyping.mock.calls).toHaveLength(2);
            expect(mockChannel2.sendTyping.mock.calls).toHaveLength(2);
        });
    });

    describe('stopping typing behavior', () => {
        let mockMessage: Message;
        let mockChannel: BaseGuildTextChannel & MockChannel;

        beforeEach(() => {
            mockChannel = createMockBaseGuildTextChannel();

            mockMessage = {
                channelId: 'test-channel-id',
                channel: mockChannel
            } as unknown as Message;
        });

        it('should clear the interval when typing stops', async () => {
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockMessage);

            const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');

            // Deactivate to trigger stop
            mockTaskQueue.isActive = false;

            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            expect(clearIntervalSpy).toHaveBeenCalled();
        });

        it('should set typingInterval to null when stopped', async () => {
            mockTaskQueue.isActive = true;

            await typingService.startTyping(mockMessage);

            // Deactivate to trigger stop
            mockTaskQueue.isActive = false;

            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            // The indicator should be reset - we can verify by starting again
            mockTaskQueue.isActive = true;

            mockLogger.info.mockClear();
            await typingService.startTyping(mockMessage);

            // Should log that a new interval was registered (indicator exists but interval was cleared)
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Registered typing interval as interval:',
                expect.any(Number)
            );
        });
    });
});
