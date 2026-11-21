import { TaskQueueStrategy } from '../enums/TaskQueueStrategy.js';
import { LlmTaskChannelPostProcessor } from './clients/llm/tasks/LlmTaskChannelPostProcessor.js';
import { ComfyUiTaskChannelPostProcessor } from './clients/media/comfy-ui/services/ComfyUiTaskChannelPostProcessor.js';
import { IGlobalConfiguration } from './environment-settings/IGlobalConfiguration.js';
import { IBotServiceContainer } from './IBotServiceContainer.js';
import { IGlobalServiceContainer } from './IGlobalServiceContainer.js';
import { ILogger } from './ILogger.js';
import { Logger } from './Logger.js';
import { GenerativeAiChannelPostProcessor } from './parallelization/GenerativeAiChannelPostProcessor.js';
import { IParallelizationStrategy } from './parallelization/IParallelizationStrategy.js';
import { ITaskChannelPostProcessor } from './parallelization/ITaskChannelPostProcessor.js';
import { NoOpTaskChannelPostProcessor } from './parallelization/NoOpTaskChannelPostProcessor.js';
import { ParallelStrategy } from './parallelization/ParallelStrategy.js';
import { CHILD_TASK_CHANNEL_SUFFIX, ResourceType } from './parallelization/ResourceType.js';
import { SerialStrategy } from './parallelization/SerialStrategy.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';
import { TaskQueue } from './tasks/TaskQueue.js';

export class GlobalServiceContainer implements IGlobalServiceContainer {
  readonly #taskQueue: ITaskQueue;
  get taskQueue(): ITaskQueue {
    return this.#taskQueue;
  }

  readonly #parallelizationStrategy: IParallelizationStrategy;
  get parallelizationStrategy(): IParallelizationStrategy {
    return this.#parallelizationStrategy;
  }

  readonly #globalConfiguration: IGlobalConfiguration;
  get globalConfiguration(): IGlobalConfiguration {
    return this.#globalConfiguration;
  }

  getLogger(prefix: string): ILogger {
    return new Logger(prefix);
  }

  getTaskChannelPostProcessor(services: IBotServiceContainer, channelName: string): ITaskChannelPostProcessor {
    if(channelName.startsWith(ResourceType.LargeLanguageModel)) {
      return new LlmTaskChannelPostProcessor(services);
    } else if(channelName.startsWith(ResourceType.Media)) {
      return new ComfyUiTaskChannelPostProcessor(services);
    } else if(channelName.startsWith(ResourceType.GenerativeAI)) {
      return new GenerativeAiChannelPostProcessor(services, this.#getChannelHostname(channelName));
    } else {
      return new NoOpTaskChannelPostProcessor();
    }
  }

  #getChannelHostname(channelName: string): string | null {
    const parts: string[] = channelName.split('_');
    const lastPart: string = parts[parts.length - 1];

    if(parts.length < 2 || lastPart === CHILD_TASK_CHANNEL_SUFFIX) {
      return null;
    }

    return lastPart;
  }

  constructor(globalConfiguration: IGlobalConfiguration) {
    this.#globalConfiguration = globalConfiguration;

    switch(this.#globalConfiguration.taskQueue.strategy) {
      case TaskQueueStrategy.Parallel:
        this.#parallelizationStrategy = new ParallelStrategy();
        break;
      default:
        this.#parallelizationStrategy = new SerialStrategy(!this.#globalConfiguration.taskQueue.forceSerialAcrossHosts);
        break;
    }

    this.#taskQueue = new TaskQueue(this);
  }
}