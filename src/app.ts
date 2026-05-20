import './polyfills.js';

import { ConfigLoader } from './services/environment-settings/ConfigLoader.js';
import { EnvironmentSettings } from './services/environment-settings/EnvironmentSettings.js';
import { GlobalServiceContainer } from './services/GlobalServiceContainer.js';
import { BotServiceContainer } from './services/BotServiceContainer.js';

const config = ConfigLoader.load();
const globalSettings = config?.global;
const botConfig = config?.bots[0];

const environmentSettings = new EnvironmentSettings(botConfig);
const globalContainer = new GlobalServiceContainer(globalSettings, environmentSettings);
const botServices = new BotServiceContainer(globalContainer, botConfig);
const featureService = botServices.featureService;
const client = botServices.generativeChatClient;

// Top-level awaits are not compatible with Parcel/Pkg. Do not replace with an await.
featureService.loadFeatures().then(() => {
    client.login();
}).catch((error) => {
    console.error(`Failed to load supported features.`
        + ` Check your workflows/workflow permissions and restart ${environmentSettings.applicationName}:`, error);
});
