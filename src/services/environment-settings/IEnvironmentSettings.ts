import { BotFunction } from '../../enums/BotFunction.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../enums/TaskQueueStrategy.js';

export interface IEnvironmentSettings {
    packageName: string;
    version: string;

    nodeEnvironment: NodeEnvironment;

    botFunction: BotFunction;

    maxTaskAttempts: number;
    taskRetryDelayMilliseconds: number;
    taskQueueStrategy: TaskQueueStrategy;
    taskQueueForceSerialAcrossHosts: boolean;

    discordToken: string;
    discordChannels: Array<string>;
    discordChannelsDisallowed: Array<string>;

    botRequiresMention: boolean;
    botResponseRate: number;
    botPrivateMessageUsers: string[];
    errorMessage: string;

    stableDiffusionHosts: Array<URL>;
    stableDiffusionGuidanceScaleInterval: number;

    ollamaHosts: Array<URL>;
    ollamaModels: Array<string>;
    ollamaSystemPrompt: string;
    ollamaStreamsResponse: boolean;

    stableDiffusionOllamaPrompts: Array<string>;

    applicationName: string;
    isProduction: boolean;
}
