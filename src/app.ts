import './polyfills.js';

import { ServiceContainer } from './services/ServiceContainer.js';

const services = new ServiceContainer();
const environmentSettings = services.environmentSettings;
const featureService = services.featureService;
const client = services.generativeChatClient;

// Top-level awaits are not compatible with Parcel/Pkg. Do not replace with an await.
featureService.loadFeatures().then(() => {
    client.login();
}).catch((error) => {
    console.error(`Failed to load supported features.`
        + ` Check your workflows/workflow permissions and restart ${environmentSettings.applicationName}:`, error);
});
