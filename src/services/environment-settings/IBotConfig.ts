import { BotMode } from '../../enums/BotMode.js';
import { TaskQueueStrategy } from '../../enums/TaskQueueStrategy.js';

export interface IBotConfig {
    botId: string;
    nodeEnvironment: string;
    mode: BotMode;

    requiresMention?: boolean;
    responseRate?: number;
    errorMessage?: string;

    chatApis: {
        discord: {
            token: string;
            channels: string[];
            privateMessageUsers: string[];
            channelsDisallowed?: string[];
        };
    };

    comfyUi: {
        hosts: string[];
        timeoutMinutes?: number;
        guidanceScaleInterval?: number;
    };

    ollama: {
        hosts: string[];
        models: string[];
        systemPrompt: string | string[];
        streamsResponse: boolean;
        embeddingModel?: string;
        topK?: number;
    };

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