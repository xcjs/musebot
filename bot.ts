import { EnvironmentSettings } from './models/EnvironmentSettings.ts';
import { DiscordEasyDiffusionClient } from './services/clients/DiscordEasyDiffusionClient.ts';

const environmentSettings = new EnvironmentSettings();
const discordEasyDiffusionClient = new DiscordEasyDiffusionClient(environmentSettings);

discordEasyDiffusionClient.login();
