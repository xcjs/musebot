import { BotMode } from '../../enums/BotMode.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../enums/TaskQueueStrategy.js';

export interface IConfigurationService {
    packageName: string;
    version: string;

    nodeEnvironment: NodeEnvironment;
    botId: string;
    botFunction: BotMode;

    discordToken: string;
    discordChannels: Array<string>;
    discordChannelsDisallowed: Array<string>;
    botRequiresMention: boolean;
    botResponseRate: number;
    botPrivateMessageUsers: string[];
    errorMessage: string;

    maxTaskAttempts: number;
    taskRetryDelayMilliseconds: number;
    taskQueueStrategy: TaskQueueStrategy;
    taskQueueForceSerialAcrossHosts: boolean;

    comfyUiHosts: Array<URL>;
    stableDiffusionHosts: Array<URL>;
    stableDiffusionGuidanceScaleInterval: number;
    stableDiffusionOllamaPrompts: Array<string>;

    ollamaHosts: Array<URL>;
    ollamaModels: Array<string>;
    ollamaSystemPrompt: string;
    ollamaStreamsResponse: boolean;

    applicationName: string;
    isProduction: boolean;
}