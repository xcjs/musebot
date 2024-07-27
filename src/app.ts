import { BotFunction } from './enums/BotFunction.js';
import { EnvironmentSettings } from './services/EnvironmentSettings.js';
import { BaseDiscordClient } from './services/clients/discord/BaseDiscordClient.js';
import { DiscordEasyDiffusionClient } from './services/clients/discord/easy-diffusion/DiscordEasyDiffusionClient.js';
import { DiscordOllamaClient } from './services/clients/discord/ollama/DiscordOllamaClient.js';
import { FeatureService } from './services/features/FeatureService.js';
import { TaskQueue } from './services/tasks/services/TaskQueue.js';

const environmentSettings = new EnvironmentSettings();
const taskQueue = new TaskQueue(environmentSettings);
const featureService = new FeatureService(environmentSettings);

let client: BaseDiscordClient;

switch(environmentSettings.botFunction) {
    case BotFunction.Images:
        client = new DiscordEasyDiffusionClient(environmentSettings, taskQueue, featureService);
        break;
    case BotFunction.Text:
        client = new DiscordOllamaClient(environmentSettings, taskQueue);
        break;
}

client.login();
