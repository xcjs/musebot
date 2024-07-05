import { EnvironmentSettings } from './models/EnvironmentSettings.js';
import { DiscordEasyDiffusionClient } from './services/clients/discord/DiscordEasyDiffusionClient.js';

const environmentSettings = new EnvironmentSettings(false);
const client = new DiscordEasyDiffusionClient(environmentSettings);

client.login();
