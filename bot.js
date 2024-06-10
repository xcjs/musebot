import { EnvironmentSettings } from './models/EnvironmentSettings.js';
import { DiscordClient } from './services/clients/DiscordClient.js';

const environmentSettings = new EnvironmentSettings();
const discordClient = new DiscordClient(environmentSettings);

discordClient.login();
