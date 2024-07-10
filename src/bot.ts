import { EnvironmentSettings } from './models/EnvironmentSettings.js';
import { DiscordEasyDiffusionService } from './services/DiscordEasyDiffusionService.js';
import { TypingService } from './services/clients/discord/services/TypingService.js';

const environmentSettings = new EnvironmentSettings();
const typingService = new TypingService(environmentSettings);

const client = new DiscordEasyDiffusionService(environmentSettings, typingService);

client.login();
