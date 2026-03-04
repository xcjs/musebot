import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { ResourceType } from '../../parallelization/ResourceType.js';
import { TaskStatus } from '../enums/TaskStatus.js';
import { BaseTask } from './BaseTask.js';
import { TaskChannel } from './TaskChannel.js';

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
            taskRetryDelayMilliseconds: 1000,
        },
        parallelizationStrategy: {
            getTaskChannel: jest.fn().mockReturnValue('test_channel'),
        },
        logger: mockLogger,
        postProcessor: mockPostProcessor,
    };
}

describe('TaskChannel', () => {
    let mockServices: ReturnType<typeof createMockServiceContainer>;
    let mockLogger: any;

    beforeEach(() => {
        mockServices = createMockServiceContainer();
        mockLogger = mockServices.logger;
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create a TaskChannel with the given name', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');

            expect(channel.name).toBe('testChannel');
        });

        it('should log channel creation', () => {
            new TaskChannel(mockServices as any, 'myChannel');

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('myChannel')
            );
        });

        it('should initialize with an empty queue', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');

            expect(channel.queue).toEqual([]);
        });
    });

    describe('name property', () => {
        it('should return the channel name', () => {
            const channel = new TaskChannel(mockServices as any, 'myChannel');

            expect(channel.name).toBe('myChannel');
        });
    });

    describe('queue property', () => {
        it('should return the queue array', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task = new MockTask(mockServices as any, 'testChannel');

            channel.queue.push(task);

            expect(channel.queue).toHaveLength(1);
            expect(channel.queue[0]).toBe(task);
        });
    });

    describe('isActive', () => {
        it('should return false when queue is empty', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');

            expect(channel.isActive).toBe(false);
        });

        it('should return false when all tasks are idle', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task = new MockTask(mockServices as any, 'testChannel');
            // Task status is Idle by default
            channel.queue.push(task);

            expect(channel.isActive).toBe(false);
        });

        it('should return true when at least one task is busy', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task = new MockTask(mockServices as any, 'testChannel');
            task.taskStatus = TaskStatus.Busy;
            channel.queue.push(task);

            expect(channel.isActive).toBe(true);
        });

        it('should return false when tasks are successful', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task = new MockTask(mockServices as any, 'testChannel');
            task.taskStatus = TaskStatus.Successful;
            channel.queue.push(task);

            expect(channel.isActive).toBe(false);
        });

        it('should return false when tasks are failed', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task = new MockTask(mockServices as any, 'testChannel');
            task.taskStatus = TaskStatus.Failed;
            channel.queue.push(task);

            expect(channel.isActive).toBe(false);
        });
    });

    describe('hasTasks', () => {
        it('should return false when queue is empty', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');

            expect(channel.hasTasks).toBe(false);
        });

        it('should return true when queue has tasks', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task = new MockTask(mockServices as any, 'testChannel');
            channel.queue.push(task);

            expect(channel.hasTasks).toBe(true);
        });
    });

    describe('cleanQueue()', () => {
        it('should remove successful tasks from the queue', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task1 = new MockTask(mockServices as any, 'testChannel');
            const task2 = new MockTask(mockServices as any, 'testChannel');
            task1.taskStatus = TaskStatus.Successful;
            task2.taskStatus = TaskStatus.Idle;

            channel.queue.push(task1, task2);
            channel.cleanQueue();

            expect(channel.queue).toHaveLength(1);
            expect(channel.queue[0]).toBe(task2);
        });

        it('should remove explicitly dead tasks from the queue', () => {
            // Directly set status to Dead by setting maxAttempts=0 and then setting Failed
            mockServices.environmentSettings.maxTaskAttempts = 0;
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task1 = new MockTask(mockServices as any, 'testChannel');
            const task2 = new MockTask(mockServices as any, 'testChannel');
            
            task1.taskStatus = TaskStatus.Dead; // Set Dead directly via setter
            task2.taskStatus = TaskStatus.Idle;

            channel.queue.push(task1, task2);
            channel.cleanQueue();

            expect(channel.queue).toHaveLength(1);
        });

        it('should remove dead tasks from the queue (after failed attempts)', () => {
            // Set max attempts to 1 so task becomes Dead on first failure
            mockServices.environmentSettings.maxTaskAttempts = 1;
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task1 = new MockTask(mockServices as any, 'testChannel');
            const task2 = new MockTask(mockServices as any, 'testChannel');
            
            // Setting Failed with maxAttempts=1 makes the task Dead
            task1.taskStatus = TaskStatus.Failed;
            task2.taskStatus = TaskStatus.Idle;

            channel.queue.push(task1, task2);
            channel.cleanQueue();

            expect(channel.queue).toHaveLength(1);
            expect(channel.queue[0]).toBe(task2);
        });

        it('should keep busy tasks in the queue', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task = new MockTask(mockServices as any, 'testChannel');
            task.taskStatus = TaskStatus.Busy;

            channel.queue.push(task);
            channel.cleanQueue();

            expect(channel.queue).toHaveLength(1);
        });

        it('should keep idle tasks in the queue', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task = new MockTask(mockServices as any, 'testChannel');
            // Idle is default status

            channel.queue.push(task);
            channel.cleanQueue();

            expect(channel.queue).toHaveLength(1);
        });

        it('should sort tasks by createdTime', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task1 = new MockTask(mockServices as any, 'testChannel');
            const task2 = new MockTask(mockServices as any, 'testChannel');

            // Manually set createdTime to ensure order
            Object.defineProperty(task1, 'createdTime', { value: new Date('2024-01-02') });
            Object.defineProperty(task2, 'createdTime', { value: new Date('2024-01-01') });

            channel.queue.push(task1, task2);
            channel.cleanQueue();

            // Task2 should be first (older)
            expect(channel.queue[0]).toBe(task2);
            expect(channel.queue[1]).toBe(task1);
        });

        it('should log when cleaning queue', () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task = new MockTask(mockServices as any, 'testChannel');
            task.taskStatus = TaskStatus.Idle;

            channel.queue.push(task);
            channel.cleanQueue();

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Removing completed or dead entries')
            );
        });

        it('should call postProcessor when queue becomes empty', async () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task = new MockTask(mockServices as any, 'testChannel');
            task.taskStatus = TaskStatus.Successful;

            channel.queue.push(task);
            channel.cleanQueue();

            // Wait for postProcess to be called
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockServices.postProcessor.postProcess).toHaveBeenCalled();
        });

        it('should not call postProcessor when queue is not empty', async () => {
            const channel = new TaskChannel(mockServices as any, 'testChannel');
            const task = new MockTask(mockServices as any, 'testChannel');
            // Keep task idle so it stays in queue

            channel.queue.push(task);
            channel.cleanQueue();

            expect(mockServices.postProcessor.postProcess).not.toHaveBeenCalled();
        });
    });
});