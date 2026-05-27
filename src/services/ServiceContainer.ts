import { BotInteraction } from '../enums/BotInteraction.js';
import { TaskQueueStrategy } from '../enums/TaskQueueStrategy.js';
import { getRandomArrayEntry } from '../utilities/random-utilities.js';
import { OllamaTaskChannelPostProcessor } from './clients/llm/ollama/tasks/OllamaTaskChannelPostProcessor.js';
import { IWorkflow } from './clients/media/comfy-ui/models/IWorkflow.js';
import { ComfyUiTaskChannelPostProcessor } from './clients/media/comfy-ui/services/ComfyUiTaskChannelPostProcessor.js';
import { IWorkflowService } from './clients/media/comfy-ui/services/IWorkflowService.js';
import { ContextualMediaMutator } from './clients/media/comfy-ui/services/workflow-mutators/ContextualMediaMutator.js';
import { ExpandPromptMutator } from './clients/media/comfy-ui/services/workflow-mutators/ExpandPromptMutator.js';
import { GuidanceScaleMutator } from './clients/media/comfy-ui/services/workflow-mutators/GuidanceScaleMutator.js';
import { IWorkflowMutator } from './clients/media/comfy-ui/services/workflow-mutators/IWorkflowMutator.js';
import { JsonMutator } from './clients/media/comfy-ui/services/workflow-mutators/JsonMutator.js';
import { MessageToMediaMutator } from './clients/media/comfy-ui/services/workflow-mutators/MessageToMediaMutator.js';
import { MessageToMusicMutator } from './clients/media/comfy-ui/services/workflow-mutators/MessageToMusicMutator.js';
import { RandomPromptMutator } from './clients/media/comfy-ui/services/workflow-mutators/RandomPromptMutator.js';
import { RetryMutator } from './clients/media/comfy-ui/services/workflow-mutators/RetryMutator.js';
import { WorkflowService } from './clients/media/comfy-ui/services/WorkflowService.js';
import { IGlobalSettings } from './environment-settings/IGlobalSettings.js';
import { ILogger } from './ILogger.js';
import { IBotServiceContainer, IServiceContainer } from './IServiceContainer.js';
import { Logger } from './Logger.js';
import { GenerativeAiChannelPostProcessor } from './parallelization/GenerativeAiChannelPostProcessor.js';
import { IParallelizationStrategy } from './parallelization/IParallelizationStrategy.js';
import { ITaskChannelPostProcessor } from './parallelization/ITaskChannelPostProcessor.js';
import { NoOpTaskChannelPostProcessor } from './parallelization/NoOpTaskChannelPostProcessor.js';
import { ParallelStrategy } from './parallelization/ParallelStrategy.js';
import { ResourceType } from './parallelization/ResourceType.js';
import { SerialStrategy } from './parallelization/SerialStrategy.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';
import { TaskQueue } from './tasks/TaskQueue.js';

export class ServiceContainer implements IServiceContainer {
    readonly #taskQueue: ITaskQueue;
    get taskQueue(): ITaskQueue {
        return this.#taskQueue;
    }

    readonly #workflowService: IWorkflowService;
    get workflowService(): IWorkflowService {
        return this.#workflowService;
    }

    readonly #parallelizationStrategy: IParallelizationStrategy;
    get parallelizationStrategy(): IParallelizationStrategy {
        return this.#parallelizationStrategy;
    }

    readonly #globalSettings: IGlobalSettings;
    get globalSettings(): IGlobalSettings {
        return this.#globalSettings;
    }

    getLogger(prefix: string): ILogger {
        return new Logger(prefix);
    }

    getTaskChannelPostProcessor(services: IBotServiceContainer, channelName: string, isChild: boolean): ITaskChannelPostProcessor {
        if(isChild) {
            return new NoOpTaskChannelPostProcessor();
        }

        if(channelName.startsWith(ResourceType.LargeLanguageModel)) {
            return new OllamaTaskChannelPostProcessor(services);
        } else if(channelName.startsWith(ResourceType.Media)) {
            return new ComfyUiTaskChannelPostProcessor(services);
        } else if(channelName.startsWith(ResourceType.GenerativeAI)) {
            return new GenerativeAiChannelPostProcessor(services);
        } else {
            return new NoOpTaskChannelPostProcessor();
        }
    }

    getWorkflowMutator(services: IBotServiceContainer, interactionType: BotInteraction, workflow: IWorkflow): IWorkflowMutator {
        const mutators: IWorkflowMutator[] = [
            new ContextualMediaMutator(services),
            new GuidanceScaleMutator(services),
            new JsonMutator(services),
            new MessageToMediaMutator(services),
            new MessageToMusicMutator(services),
            new ExpandPromptMutator(services),
            new RandomPromptMutator(services),
            new RetryMutator(services)
        ];

        const supportedMutators = mutators.filter(
            mutator => mutator.interactions.includes(interactionType)
                && mutator.types.includes(workflow.type));

        if(supportedMutators.length === 1) {
            return supportedMutators[0];
        } else if(supportedMutators.length > 1) {
            const mutator = getRandomArrayEntry(supportedMutators);

            if(mutator === null) {
                throw new Error('A supported mutator could not be found.');
            }

            return mutator;
        } else {
            throw new Error('The task you are attempting to instantiate is not supported by your current configuration.');
        }
    }

    constructor(globalSettings: IGlobalSettings) {
        this.#globalSettings = globalSettings;
        this.#workflowService = new WorkflowService(this.getLogger('WorkflowService'));

        switch(this.#globalSettings.taskQueueStrategy) {
            case TaskQueueStrategy.Parallel:
                this.#parallelizationStrategy = new ParallelStrategy();
                break;
            default:
                this.#parallelizationStrategy = new SerialStrategy(!this.#globalSettings.taskQueueForceSerialAcrossHosts);
                break;
        }

        this.#taskQueue = new TaskQueue(this);
    }
}
