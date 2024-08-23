import { BotFunction } from './enums/BotFunction.js';
import { EnvironmentSettings } from './services/EnvironmentSettings.js';
import { BaseDiscordClient } from './services/clients/discord/BaseDiscordClient.js';
import { DiscordAutomatic1111Client } from './services/clients/discord/automatic1111/DiscordAutomatic1111Client.js';
import { DiscordEasyDiffusionClient } from './services/clients/discord/easy-diffusion/DiscordEasyDiffusionClient.js';
import { DiscordOllamaClient } from './services/clients/discord/ollama/DiscordOllamaClient.js';
import { TypingService } from './services/clients/discord/services/TypingService.js';
import { StableDiffusionApiType } from './services/clients/stable-diffusion/enums/StableDiffusionApiType.js';
import { FeatureService } from './services/features/FeatureService.js';
import { TaskQueue } from './services/tasks/services/TaskQueue.js';

const environmentSettings = new EnvironmentSettings();
const featureService = new FeatureService(environmentSettings);
const taskQueue = new TaskQueue(environmentSettings);
const typingService = new TypingService(environmentSettings, taskQueue);

let client: BaseDiscordClient;

switch(environmentSettings.botFunction) {
    case BotFunction.Images:
        switch(environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                client = new DiscordAutomatic1111Client(environmentSettings, featureService, taskQueue, typingService);
                break;
                case StableDiffusionApiType.EasyDiffusion:
                client = new DiscordEasyDiffusionClient(environmentSettings, featureService, taskQueue, typingService);
                break;
        }
        break;
    case BotFunction.Text:
        client = new DiscordOllamaClient(environmentSettings, featureService, taskQueue, typingService);
        break;
}

client.login();
