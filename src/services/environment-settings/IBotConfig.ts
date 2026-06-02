/**
 * Configuration interface for bot settings.
 *
 * Supports two configuration formats for delimited fields:
 * - .env file: comma-separated strings (e.g., "channel1,channel2")
 * - config.json: native JSON arrays (e.g., ["channel1", "channel2"])
 *
 * The EnvironmentSettings class normalizes both formats to arrays internally,
 * ensuring consistent behavior regardless of which format is used.
 */
export interface IBotConfig {
    botId: string;
    nodeEnvironment?: string;
    botFunction?: string;
    maxTaskAttempts?: number;
    taskRetryDelayMilliseconds?: number;
    taskQueueStrategy?: string;
    taskQueueForceSerialAcrossHosts?: boolean;
    discordToken: string;
    discordChannels?: string | string[];
    discordChannelsDisallowed?: string | string[];
    botRequiresMention?: boolean;
    botResponseRate?: number;
    botPrivateMessageUsers?: string | string[];
    errorMessage?: string;
    stableDiffusionHosts?: string | string[];
    stableDiffusionGuidanceScaleInterval?: number;
    ollamaHosts?: string | string[];
    ollamaModels?: string | string[];
    ollamaSystemPrompt?: string;
    ollamaStreamsResponse?: boolean;
    stableDiffusionOllamaPrompts?: string | string[];
}
