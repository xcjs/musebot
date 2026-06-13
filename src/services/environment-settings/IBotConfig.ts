import { BotMode } from '../../enums/BotMode.js';
import { TaskQueueStrategy } from '../../enums/TaskQueueStrategy.js';

export interface IBotConfig {
    botId: string;
    nodeEnvironment: string;
    mode: BotMode;

    requiresMention?: boolean;
    responseRate?: number;
    errorMessage?: string;

    discord: {
        token: string;
        channels: string[];
        privateMessageUsers: string[];
        channelsDisallowed?: string[];
    };

    chatApis?: {
        discord: {
            token: string;
            channels: string[];
            privateMessageUsers: string[];
        };
    };

    comfyUi: {
        hosts: string[];
    };

    ollama: {
        hosts: string[];
        models: string[];
        systemPrompt: string | string[];
        streamsResponse: boolean;
    };

    comfyUiGuidanceScaleInterval: number;

    multiModal?: {
        randomPrompts: string[];
    };

    taskQueue?: {
        numAttempts?: number;
        retryDelayMs?: number;
        strategy?: TaskQueueStrategy;
        forceSerialAcrossHosts?: boolean;
    };
}