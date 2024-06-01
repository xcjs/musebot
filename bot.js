import { EnvironmentSettings } from './models/EnvironmentSettings';
import { DiscordClient } from './services/clients/DiscordClient';

const environmentSettings = new EnvironmentSettings();
const discordClient = new DiscordClient(environmentSettings);

discordClient.login();
