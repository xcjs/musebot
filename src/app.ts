import { ServiceContainer } from './services/ServiceContainer.js';

const services = new ServiceContainer();
const featureService = services.featureService;
const client = services.generativeChatClient;

featureService.loadFeatures().then(() => {
    client.login();
}).catch((error) => {
    console.error(`Failed to load supported features.`
        + ` Check your workflows/workflow permissions and restart Musebot: ${error}`);
});
