import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createMockLogger, createMockPostProcessor, createMockServiceContainer, MockContainer } from '../../../test-utils/mockServiceContainer.js';
import type { ILogger } from '../../ILogger.js';
import type { ITaskChannelPostProcessor } from '../../parallelization/ITaskChannelPostProcessor.js';
import { TaskStatus } from '../enums/TaskStatus.js';
import { BaseTask } from './BaseTask.js';
import { TaskChannel } from './TaskChannel.js';

// Mock BaseTask implementation
class MockTask extends BaseTask<unknown> {
    readonly #taskChannelName: string;
    readonly #processMock: () => Promise<void>;
    readonly #postProcessMock: () => Promise<void>;

    constructor(
        services: MockContainer,
        taskChannelName: string,
        processMock?: () => Promise<void>,
        postProcessMock?: () => Promise<void>
    ) {
        super(services);
        this.#taskChannelName = taskChannelName;
        this.#processMock = processMock ?? ((): Promise<void> => Promise.resolve());
        this.#postProcessMock = postProcessMock ?? ((): Promise<void> => Promise.resolve());
    }

    get taskChannel(): string {
        return this.#taskChannelName;
    }

    override process(): Promise<void> {
        return this.#processMock();
    }

    override postProcess(): Promise<void> {
        return this.#postProcessMock();
    }
}

describe('TaskChannel', () => {
    let mockServices: MockContainer;
    let mockLogger: jest.Mocked<ILogger>;
    let mockPostProcessor: jest.Mocked<ITaskChannelPostProcessor>;

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockPostProcessor = createMockPostProcessor();
        mockServices = createMockServiceContainer({
            logger: mockLogger,
            postProcessor: mockPostProcessor,
        });
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create a TaskChannel with the given name', (): void => {
            const channel = new TaskChannel(mockServices, 'testChannel');

            expect(channel.name).toBe('testChannel');
        });

        it('should log channel creation', (): void => {
            new TaskChannel(mockServices, 'myChannel');

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('myChannel')
            );
        });

        it('should initialize with an empty queue', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');

            expect(channel.queue).toEqual([]);
        });
    });

    describe('name property', () => {
        it('should return the channel name', () => {
            const channel = new TaskChannel(mockServices, mockServices, 'myChannel');

            expect(channel.name).toBe('myChannel');
        });
    });

    describe('queue property', () => {
        it('should return the queue array', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task = new MockTask(mockServices, 'testChannel');

            channel.queue.push(task);

            expect(channel.queue).toHaveLength(1);
            expect(channel.queue[0]).toBe(task);
        });
    });

    describe('isActive', () => {
        it('should return false when queue is empty', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');

            expect(channel.isActive).toBe(false);
        });

        it('should return false when all tasks are idle', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task = new MockTask(mockServices, 'testChannel');
            channel.queue.push(task);

            expect(channel.isActive).toBe(false);
        });

        it('should return true when at least one task is busy', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task = new MockTask(mockServices, 'testChannel');
            task.taskStatus = TaskStatus.Busy;
            channel.queue.push(task);

            expect(channel.isActive).toBe(true);
        });

        it('should return false when tasks are successful', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task = new MockTask(mockServices, 'testChannel');
            task.taskStatus = TaskStatus.Successful;
            channel.queue.push(task);

            expect(channel.isActive).toBe(false);
        });

        it('should return false when tasks are failed', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task = new MockTask(mockServices, 'testChannel');
            task.taskStatus = TaskStatus.Failed;
            channel.queue.push(task);

            expect(channel.isActive).toBe(false);
        });
    });

    describe('hasTasks', () => {
        it('should return false when queue is empty', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');

            expect(channel.hasTasks).toBe(false);
        });

        it('should return true when queue has tasks', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task = new MockTask(mockServices, 'testChannel');
            channel.queue.push(task);

            expect(channel.hasTasks).toBe(true);
        });
    });

    describe('cleanQueue()', () => {
        it('should remove successful tasks from the queue', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task1 = new MockTask(mockServices, 'testChannel');
            const task2 = new MockTask(mockServices, 'testChannel');
            task1.taskStatus = TaskStatus.Successful;
            task2.taskStatus = TaskStatus.Idle;

            channel.queue.push(task1, task2);
            channel.cleanQueue();

            expect(channel.queue).toHaveLength(1);
            expect(channel.queue[0]).toBe(task2);
        });

        it('should remove explicitly dead tasks from the queue', () => {
            const services = createMockServiceContainer({
                logger: mockLogger,
                postProcessor: mockPostProcessor,
                environmentSettings: { maxTaskAttempts: 0 } as never,
            });
            const channel = new TaskChannel(services, services, 'testChannel');
            const task1 = new MockTask(services, 'testChannel');
            const task2 = new MockTask(services, 'testChannel');

            task1.taskStatus = TaskStatus.Dead;
            task2.taskStatus = TaskStatus.Idle;

            channel.queue.push(task1, task2);
            channel.cleanQueue();

            expect(channel.queue).toHaveLength(1);
        });

        it('should remove dead tasks from the queue (after failed attempts)', () => {
            const services = createMockServiceContainer({
                logger: mockLogger,
                postProcessor: mockPostProcessor,
                environmentSettings: { maxTaskAttempts: 1 } as never,
            });
            const channel = new TaskChannel(services, services, 'testChannel');
            const task1 = new MockTask(services, 'testChannel');
            const task2 = new MockTask(services, 'testChannel');

            task1.taskStatus = TaskStatus.Failed;
            task2.taskStatus = TaskStatus.Idle;

            channel.queue.push(task1, task2);
            channel.cleanQueue();

            expect(channel.queue).toHaveLength(1);
            expect(channel.queue[0]).toBe(task2);
        });

        it('should keep busy tasks in the queue', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task = new MockTask(mockServices, 'testChannel');
            task.taskStatus = TaskStatus.Busy;

            channel.queue.push(task);
            channel.cleanQueue();

            expect(channel.queue).toHaveLength(1);
        });

        it('should keep idle tasks in the queue', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task = new MockTask(mockServices, 'testChannel');

            channel.queue.push(task);
            channel.cleanQueue();

            expect(channel.queue).toHaveLength(1);
        });

        it('should sort tasks by createdTime', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task1 = new MockTask(mockServices, 'testChannel');
            const task2 = new MockTask(mockServices, 'testChannel');

            Object.defineProperty(task1, 'createdTime', { value: new Date('2024-01-02') });
            Object.defineProperty(task2, 'createdTime', { value: new Date('2024-01-01') });

            channel.queue.push(task1, task2);
            channel.cleanQueue();

            expect(channel.queue[0]).toBe(task2);
            expect(channel.queue[1]).toBe(task1);
        });

        it('should log when cleaning queue', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task = new MockTask(mockServices, 'testChannel');
            task.taskStatus = TaskStatus.Idle;

            channel.queue.push(task);
            channel.cleanQueue();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Removing completed or dead entries')
            );
        });

        it('should call postProcessor when queue becomes empty', async () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task = new MockTask(mockServices, 'testChannel');
            task.taskStatus = TaskStatus.Successful;

            channel.queue.push(task);
            channel.cleanQueue();

            await new Promise(resolve => setTimeout(resolve, 10));

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(mockPostProcessor.postProcess).toHaveBeenCalled();
        });

        it('should not call postProcessor when queue is not empty', () => {
            const channel = new TaskChannel(mockServices, 'testChannel');
            const task = new MockTask(mockServices, 'testChannel');

            channel.queue.push(task);
            channel.cleanQueue();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(mockPostProcessor.postProcess).not.toHaveBeenCalled();
        });
    });
});
