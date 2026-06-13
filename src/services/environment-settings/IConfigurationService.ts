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
    discordChannels: string[];
    discordChannelsDisallowed: string[];
    botRequiresMention: boolean;
    botResponseRate: number;
    botPrivateMessageUsers: string[];
    errorMessage: string;

    maxTaskAttempts: number;
    taskRetryDelayMilliseconds: number;
    taskQueueStrategy: TaskQueueStrategy;
    taskQueueForceSerialAcrossHosts: boolean;

    comfyUiHosts: URL[];
    comfyUiGuidanceScaleInterval: number;
    comfyUiOllamaPrompts: string[];

    ollamaHosts: URL[];
    ollamaModels: string[];
    ollamaSystemPrompt: string;
    ollamaStreamsResponse: boolean;

    applicationName: string;
    isProduction: boolean;
}