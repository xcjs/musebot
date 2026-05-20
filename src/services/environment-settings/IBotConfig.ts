export interface IBotConfig {
    nodeEnvironment?: string;
    botFunction?: string;
    maxTaskAttempts?: number;
    taskRetryDelayMilliseconds?: number;
    taskQueueStrategy?: string;
    taskQueueForceSerialAcrossHosts?: boolean;
    discordToken: string;
    discordChannels?: string;
    discordChannelsDisallowed?: string;
    botRequiresMention?: boolean;
    botResponseRate?: number;
    botPrivateMessageUsers?: string;
    errorMessage?: string;
    stableDiffusionHosts?: string;
    stableDiffusionGuidanceScaleInterval?: number;
    ollamaHosts?: string;
    ollamaModels?: string;
    ollamaSystemPrompt?: string;
    ollamaStreamsResponse?: boolean;
    stableDiffusionOllamaPrompts?: string;
}
