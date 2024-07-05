import { EnvironmentSettings } from './models/EnvironmentSettings.js';
import { DiscordEasyDiffusionClient } from './services/clients/discord/DiscordEasyDiffusionClient.js';
import { TypingService } from './services/clients/discord/services/TypingService.js';

const environmentSettings = new EnvironmentSettings(false);
const typingService = new TypingService(environmentSettings);

const client = new DiscordEasyDiffusionClient(environmentSettings, typingService);

client.login();
