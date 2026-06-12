import { IGlobalConfiguration } from './environment-settings/IGlobalConfiguration.js';
import { IBotServiceContainer } from './IBotServiceContainer.js';
import { ILogger } from './ILogger.js';
import { IParallelizationStrategy } from './parallelization/IParallelizationStrategy.js';
import { ITaskChannelPostProcessor } from './parallelization/ITaskChannelPostProcessor.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';

/**
 * Global service container - shared across all bot instances
 */
export interface IGlobalServiceContainer {
    globalConfiguration: IGlobalConfiguration;
    taskQueue: ITaskQueue;
    parallelizationStrategy: IParallelizationStrategy;

    getLogger(prefix: string): ILogger;
    getTaskChannelPostProcessor(services: IBotServiceContainer, channelName: string, isChild: boolean): ITaskChannelPostProcessor;
}