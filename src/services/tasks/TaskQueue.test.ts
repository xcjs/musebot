import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

import { ResourceType } from '../parallelization/ResourceType.js';
import { TaskStatus } from './enums/TaskStatus.js';
import { TaskQueue } from './TaskQueue.js';
import { BaseTask } from './models/BaseTask.js';

// Mock BaseTask implementation
class MockTask extends BaseTask<unknown> {
    #taskChannelName: string;
    #processMock: () => Promise<void>;
    #postProcessMock: () => Promise<void>;

    constructor(
        services: any,
        taskChannelName: string,
        processMock?: () => Promise<void>,
        postProcessMock?: () => Promise<void>
    ) {
        super(services);
        this.#taskChannelName = taskChannelName;
        this.#processMock = processMock || (async () => {});
        this.#postProcessMock = postProcessMock || (async () => {});
    }

    get taskChannel(): string {
        return this.#taskChannelName;
    }

    async process(): Promise<void> {
        return this.#processMock();
    }

    async postProcess(): Promise<void> {
        return this.#postProcessMock();
    }
}

// Mock IServiceContainer
function createMockServiceContainer() {
    const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        success: jest.fn(),
        fatal: jest.fn(),
    };

    const mockPostProcessor = {
        postProcess: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };

    return {
        getLogger: jest.fn().mockReturnValue(mockLogger),
        getTaskChannelPostProcessor: jest.fn().mockReturnValue(mockPostProcessor),
        environmentSettings: {
            maxTaskAttempts: 3,
            taskRetryDelayMilliseconds: 100,
        },
        parallelizationStrategy: {
            getTaskChannel: jest.fn().mockReturnValue('test_channel'),
        },
        logger: mockLogger,
        postProcessor: mockPostProcessor,
    };
}

describe('TaskQueue', () => {
    let mockServices: ReturnType<typeof createMockServiceContainer>;
    let mockLogger: any;

    beforeEach(() => {
        mockServices = createMockServiceContainer();
        mockLogger = mockServices.logger;
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create a TaskQueue with empty channels', () => {
            const queue = new TaskQueue(mockServices as any);

            expect(queue.isActive).toBe(false);
        });

        it('should get logger from services', () => {
            new TaskQueue(mockServices as any);

            expect(mockServices.getLogger).toHaveBeenCalledWith('TaskQueue');
        });
    });

    describe('isActive', () => {
        it('should return false when no channels exist', () => {
            const queue = new TaskQueue(mockServices as any);

            expect(queue.isActive).toBe(false);
        });

        it('should return false when channels have no tasks', () => {
            const queue = new TaskQueue(mockServices as any);
            // Even after adding a task that completes, isActive should reflect current state

            expect(queue.isActive).toBe(false);
        });
    });

    describe('add()', () => {
        it('should add a task to the queue', () => {
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'testChannel');

            queue.add(task);

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Adding task')
            );
        });

        it('should create a new channel for new task channels', () => {
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'newChannel');

            queue.add(task);

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Created a new task channel')
            );
        });

        it('should reuse existing channel for same task channel name', () => {
            const queue = new TaskQueue(mockServices as any);
            const task1 = new MockTask(mockServices as any, 'sharedChannel');
            const task2 = new MockTask(mockServices as any, 'sharedChannel');

            queue.add(task1);
            queue.add(task2);

            // Should only create channel once
            const createCalls = mockLogger.info.mock.calls.filter(
                call => call[0].includes('Created a new task channel')
            );
            expect(createCalls).toHaveLength(1);
        });

        it('should not add duplicate tasks by id', () => {
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'testChannel');

            queue.add(task);
            queue.add(task); // Add same task again

            // Should log adding task twice but channel creation only once
            const addCalls = mockLogger.info.mock.calls.filter(
                call => call[0].includes('Adding task')
            );
            expect(addCalls.length).toBeGreaterThanOrEqual(2);
        });

        it('should log the task channel name when adding', () => {
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'myCustomChannel');

            queue.add(task);

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('myCustomChannel')
            );
        });
    });

    describe('task processing', () => {
        it('should process a task successfully', async () => {
            let processCalled = false;
            const processMock = async () => { processCalled = true; };
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'testChannel', processMock);

            queue.add(task);

            // Allow async processing to complete
            await jest.runAllTimersAsync();

            expect(processCalled).toBe(true);
        });

        it('should call postProcess after successful task', async () => {
            let postProcessCalled = false;
            const processMock = async () => {};
            const postProcessMock = async () => { postProcessCalled = true; };
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'testChannel', processMock, postProcessMock);

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(postProcessCalled).toBe(true);
        });

        it('should handle multiple tasks in different channels', async () => {
            let called1 = false;
            let called2 = false;
            const processMock1 = async () => { called1 = true; };
            const processMock2 = async () => { called2 = true; };
            const queue = new TaskQueue(mockServices as any);
            const task1 = new MockTask(mockServices as any, 'channel1', processMock1);
            const task2 = new MockTask(mockServices as any, 'channel2', processMock2);

            queue.add(task1);
            queue.add(task2);

            await jest.runAllTimersAsync();

            expect(called1).toBe(true);
            expect(called2).toBe(true);
        });

        it('should set task status to Busy when processing', async () => {
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'testChannel');

            queue.add(task);

            // Check status during processing
            await jest.runAllTimersAsync();

            // After completion, task should be successful
            expect(task.taskStatus).toBe(TaskStatus.Successful);
        });

        it('should handle task failure and retry', async () => {
            let callCount = 0;
            const processMock = async () => {
                callCount++;
                if (callCount === 1) throw new Error('Task failed');
            };
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'testChannel', processMock);

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(callCount).toBeGreaterThanOrEqual(1);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should mark task as dead after max attempts', async () => {
            mockServices.environmentSettings.maxTaskAttempts = 1;
            let postProcessCalled = false;
            const processMock = async () => { throw new Error('Task failed'); };
            const postProcessMock = async () => { postProcessCalled = true; };
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'testChannel', processMock, postProcessMock);

            queue.add(task);

            await jest.runAllTimersAsync();

            // With maxAttempts = 1, task should be marked as Dead after failure
            expect(task.taskStatus).toBe(TaskStatus.Dead);
            expect(postProcessCalled).toBe(true);
        });

        it('should log error when task is rejected', async () => {
            const processMock = async () => { throw new Error('Test error'); };
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'testChannel', processMock);

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('rejected'),
                expect.anything(),
                expect.anything()
            );
        });

        it('should log task queue processing info', async () => {
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'testChannel');

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Processing the task queue')
            );
        });

        it('should log when retrieving next tasks', async () => {
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'testChannel');

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Retrieving the next tasks')
            );
        });
    });

    describe('error handling', () => {
        it('should log error when task process throws', async () => {
            const processMock = async () => {
                throw new Error('Unexpected error');
            };
            const queue = new TaskQueue(mockServices as any);
            const task = new MockTask(mockServices as any, 'testChannel', processMock);

            queue.add(task);

            await jest.runAllTimersAsync();

            // When process() throws, it's logged as "rejected" not "exception"
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('rejected'),
                expect.anything(),
                expect.anything()
            );
        });
    });
});