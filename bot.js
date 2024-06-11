import { EnvironmentSettings } from './models/EnvironmentSettings.js';
import { DiscordEasyDiffusionClient } from './services/clients/DiscordEasyDiffusionClient.js';

const environmentSettings = new EnvironmentSettings();
const discordEasyDiffusionClient = new DiscordEasyDiffusionClient(environmentSettings);

discordEasyDiffusionClient.login();
