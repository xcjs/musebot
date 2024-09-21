import { Client as DiscordClient } from 'discord.js';
import { TypingService } from './clients/discord/services/TypingService';
import { EnvironmentSettings } from './EnvironmentSettings';
import { FeatureService } from './features/FeatureService';
import { TaskQueue } from './tasks/services/TaskQueue';
import { MessageService } from './clients/discord/services/MessageService';
import { Automatic1111Client } from './clients/automatic1111/Automatic1111Client';
import { DiscordAutomatic1111Client } from './clients/discord/automatic1111/DiscordAutomatic1111Client';
import { EasyDiffusionClient } from './clients/easy-diffusion/EasyDiffusionClient';
import { DiscordEasyDiffusionClient } from './clients/discord/easy-diffusion/DiscordEasyDiffusionClient';
import { OllamaClient } from './clients/ollama/OllamaClient';
import { DiscordOllamaClient } from './clients/discord/ollama/DiscordOllamaClient';

export interface IServiceContainer {
    // Singletons -------------------------------------------------------------/

    environmentSettings: EnvironmentSettings;
    featureService: FeatureService;
    taskQueue: TaskQueue;
    typingService: TypingService;
    discordClient: DiscordClient;

    // Transitives ------------------------------------------------------------/

    messageService: MessageService;
    automatic1111Client: Automatic1111Client;
    discordAutomatic1111Client: DiscordAutomatic1111Client;
    easyDiffusionClient: EasyDiffusionClient;
    discordEasyDiffusionClient: DiscordEasyDiffusionClient;
    ollamaClient: OllamaClient;
    discordOllamaClient: DiscordOllamaClient;
}
