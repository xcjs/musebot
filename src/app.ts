import { BotFunction } from './enums/BotFunction.js';
import { EnvironmentSettings } from './services/EnvironmentSettings.js';
import { BaseDiscordClient } from './services/clients/discord/BaseDiscordClient.js';
import { DiscordEasyDiffusionClient } from './services/clients/discord/DiscordEasyDiffusionClient.js';
import { DiscordOllamaClient } from './services/clients/discord/DiscordOllamaClient.js';
import { TypingService } from './services/clients/discord/services/TypingService.js';

const environmentSettings = new EnvironmentSettings();
const typingService = new TypingService(environmentSettings);

let client: BaseDiscordClient;

switch(environmentSettings.botFunction) {
    case BotFunction.Images:
        client = new DiscordEasyDiffusionClient(environmentSettings, typingService);
        break;
    case BotFunction.Text:
        client = new DiscordOllamaClient(environmentSettings, typingService);
        break;
}

client.login();
