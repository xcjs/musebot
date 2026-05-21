import './polyfills.js';

import { BotServiceContainer } from './services/BotServiceContainer.js';
import { ConfigLoader } from './services/environment-settings/ConfigLoader.js';
import { GlobalServiceContainer } from './services/GlobalServiceContainer.js';

const config = ConfigLoader.load();
const globalSettings = config?.global;
const botConfigs = config?.bots ?? [];

const globalContainer = new GlobalServiceContainer(globalSettings);

botConfigs.forEach(botConfig => {
    const botServices = new BotServiceContainer(globalContainer, botConfig);
    const featureService = botServices.featureService;
    const client = botServices.generativeChatClient;
    const settings = botServices.environmentSettings;

    // Top-level awaits are not compatible with Parcel/Pkg. Do not replace with an await.
    featureService.loadFeatures().then(() => {
        client.login();
    }).catch((error) => {
        console.error(`Failed to load supported features.`
            + ` Check your workflows/workflow permissions and restart ${settings.applicationName}:`, error);
    });
});
