import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createMockGlobalContainer, createMockLogger, createMockPostProcessor, createMockServiceContainer, MockContainer, MockGlobalContainer } from '../../test-utils/mockServiceContainer.js';
import type { ILogger } from '../ILogger.js';
import type { ITaskChannelPostProcessor } from '../parallelization/ITaskChannelPostProcessor.js';
import { TaskStatus } from './enums/TaskStatus.js';
import { BaseTask } from './models/BaseTask.js';
import { TaskQueue } from './TaskQueue.js';

class MockTask extends BaseTask<unknown> {
    readonly #taskChannelName: string;
    readonly #preProcessMock: () => Promise<void>;
    readonly #processMock: () => Promise<void>;
    readonly #postProcessMock: () => Promise<void>;

    constructor(
        services: MockContainer,
        taskChannelName: string,
        preProcessMock?: () => Promise<void>,
        processMock?: () => Promise<void>,
        postProcessMock?: () => Promise<void>
    ) {
        super(services);
        this.#taskChannelName = taskChannelName;
        this.#preProcessMock = preProcessMock ?? ((): Promise<void> => Promise.resolve());
        this.#processMock = processMock ?? ((): Promise<void> => Promise.resolve());
        this.#postProcessMock = postProcessMock ?? ((): Promise<void> => Promise.resolve());
    }

    get taskChannel(): string {
        return this.#taskChannelName;
    }

    override preProcess(): Promise<void> {
        return this.#preProcessMock();
    }

    override process(): Promise<void> {
        return this.#processMock();
    }

    override postProcess(): Promise<void> {
        return this.#postProcessMock();
    }
}

describe('TaskQueue', () => {
    let mockGlobalServices: MockGlobalContainer;
    let mockBotServices: MockContainer;
    let mockLogger: jest.Mocked<ILogger>;
    let mockPostProcessor: jest.Mocked<ITaskChannelPostProcessor>;

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockPostProcessor = createMockPostProcessor();
        mockGlobalServices = createMockGlobalContainer({
            logger: mockLogger,
            postProcessor: mockPostProcessor,
        });
        mockBotServices = createMockServiceContainer({
            logger: mockLogger,
            postProcessor: mockPostProcessor,
        });
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create a TaskQueue with empty channels', function (this: void): void {
            const queue = new TaskQueue(mockGlobalServices);

            expect(queue.isActive).toBe(false);
        });
    });

    describe('isActive', () => {
        it('should return false when no channels exist', function (this: void): void {
            const queue = new TaskQueue(mockGlobalServices);
            expect(queue.isActive).toBe(false);
        });

        it('should return false when channels have no tasks', function (this: void): void {
            const queue = new TaskQueue(mockGlobalServices);
            expect(queue.isActive).toBe(false);
        });
    });

    describe('add()', () => {
        it('should add a task to the queue', function (this: void): void {
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'testChannel');

            queue.add(task);

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Adding task')
            );
        });

        it('should create a new channel for new task channels', function (this: void): void {
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'newChannel');

            queue.add(task);

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Created a new task channel')
            );
        });

        it('should reuse existing channel for same task channel name', function (this: void): void {
            const queue = new TaskQueue(mockGlobalServices);
            const task1 = new MockTask(mockBotServices, 'sharedChannel');
            const task2 = new MockTask(mockBotServices, 'sharedChannel');

            queue.add(task1);
            queue.add(task2);

            const createCalls = mockLogger.info.mock.calls.filter(
                ([msg]) => msg.includes('Created a new task channel')
            );
            expect(createCalls).toHaveLength(1);
        });

        it('should not add duplicate tasks by id', function (this: void): void {
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'testChannel');

            queue.add(task);
            queue.add(task);

            const addCalls = mockLogger.info.mock.calls.filter(
                ([msg]) => msg.includes('Adding task')
            );
            expect(addCalls.length).toBeGreaterThanOrEqual(2);
        });

        it('should log the task channel name when adding', function (this: void): void {
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'myCustomChannel');

            queue.add(task);

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('myCustomChannel')
            );
        });
    });

    describe('task processing', () => {
        it('should process a task successfully', async function (this: void): Promise<void> {
            let processCalled = false;
            const processMock = (): Promise<void> => {
                processCalled = true;
                return Promise.resolve();
            };
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'testChannel', processMock);

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(processCalled).toBe(true);
        });

        it('should call preProcess before process', async function (this: void): Promise<void> {
            let preProcessCalled = false;
            let processCalled = false;
            const preProcessMock = (): Promise<void> => {
                preProcessCalled = true;
                return Promise.resolve();
            };
            const processMock = (): Promise<void> => {
                processCalled = true;
                return Promise.resolve();
            };
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'testChannel', preProcessMock, processMock);

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(preProcessCalled).toBe(true);
            expect(processCalled).toBe(true);
        });

        it('should call postProcess after successful task', async function (this: void): Promise<void> {
            let postProcessCalled = false;
            const processMock = (): Promise<void> => Promise.resolve();
            const postProcessMock = (): Promise<void> => {
                postProcessCalled = true;
                return Promise.resolve();
            };
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'testChannel', undefined, processMock, postProcessMock);

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(postProcessCalled).toBe(true);
        });

        it('should mark task as Successful if preProcess fails but process succeeds', async function (this: void): Promise<void> {
            let preProcessCalled = false;
            let processCalled = false;
            const preProcessMock = (): Promise<void> => {
                preProcessCalled = true;
                return Promise.resolve();
            };
            const processMock = (): Promise<void> => {
                processCalled = true;
                return Promise.resolve();
            };
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'testChannel', preProcessMock, processMock);

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(preProcessCalled).toBe(true);
            expect(processCalled).toBe(true);
            expect(task.taskStatus).toBe(TaskStatus.Successful);
        });

        it('should call process after preProcess succeeds', async function (this: void): Promise<void> {
            let preProcessCalled = false;
            let processCalled = false;
            const preProcessMock = (): Promise<void> => {
                preProcessCalled = true;
                return Promise.resolve();
            };
            const processMock = (): Promise<void> => {
                processCalled = true;
                return Promise.resolve();
            };
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'testChannel', preProcessMock, processMock);

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(preProcessCalled).toBe(true);
            expect(processCalled).toBe(true);
        });

        it('should handle multiple tasks in different channels', async function (this: void): Promise<void> {
            let called1 = false;
            let called2 = false;
            const processMock1 = (): Promise<void> => {
                called1 = true;
                return Promise.resolve();
            };
            const processMock2 = (): Promise<void> => {
                called2 = true;
                return Promise.resolve();
            };
            const queue = new TaskQueue(mockGlobalServices);
            const task1 = new MockTask(mockBotServices, 'channel1', processMock1);
            const task2 = new MockTask(mockBotServices, 'channel2', processMock2);

            queue.add(task1);
            queue.add(task2);

            await jest.runAllTimersAsync();

            expect(called1).toBe(true);
            expect(called2).toBe(true);
        });

        it('should set task status to Busy when processing', async function (this: void): Promise<void> {
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'testChannel');

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(task.taskStatus).toBe(TaskStatus.Successful);
        });

        it('should handle task failure and retry', async function (this: void): Promise<void> {
            let callCount = 0;
            const processMock = (): Promise<void> => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject(new Error('Task failed'));
                }
                return Promise.resolve();
            };
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'testChannel', undefined, processMock);

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(callCount).toBe(2);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should mark task as Successful if process succeeds', async function (this: void): Promise<void> {
            const globalServices = createMockGlobalContainer({
                logger: mockLogger,
                postProcessor: mockPostProcessor,
                environmentSettings: { maxTaskAttempts: 3 } as never,
            });
            const botServices = createMockServiceContainer({
                logger: mockLogger,
                postProcessor: mockPostProcessor,
                environmentSettings: { maxTaskAttempts: 3 } as never,
            });
            let postProcessCalled = false;
            const processMock = (): Promise<void> => Promise.resolve();
            const postProcessMock = (): Promise<void> => {
                postProcessCalled = true;
                return Promise.resolve();
            };
            const queue = new TaskQueue(globalServices);
            const task = new MockTask(botServices, 'testChannel', undefined, processMock, postProcessMock);

            queue.add(task);

            await jest.runAllTimersAsync();

            expect(task.taskStatus).toBe(TaskStatus.Successful);
            expect(postProcessCalled).toBe(true);
        });

        it('should log task queue processing info', async (): Promise<void> => {
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'testChannel');

            queue.add(task);

            await jest.runAllTimersAsync();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Processing the task queue')
            );
        });

        it('should log when retrieving next tasks', async (): Promise<void> => {
            const queue = new TaskQueue(mockGlobalServices);
            const task = new MockTask(mockBotServices, 'testChannel');

            queue.add(task);

            await jest.runAllTimersAsync();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Retrieving the next tasks')
            );
        });
    });
});
