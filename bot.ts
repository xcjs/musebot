import { EnvironmentSettings } from './models/EnvironmentSettings';
import { DiscordEasyDiffusionClient } from './services/clients/DiscordEasyDiffusionClient';

const environmentSettings = new EnvironmentSettings();
const discordEasyDiffusionClient = new DiscordEasyDiffusionClient(environmentSettings);

discordEasyDiffusionClient.login();
