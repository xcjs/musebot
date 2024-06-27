import { EnvironmentSettings } from './models/EnvironmentSettings';
import { DiscordEasyDiffusionClient } from './services/clients/DiscordEasyDiffusionClient';

const environmentSettings = new EnvironmentSettings();
const client = new DiscordEasyDiffusionClient(environmentSettings);

client.login();
