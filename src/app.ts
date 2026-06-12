import './polyfills.js';

import { BotServiceContainer } from './services/BotServiceContainer.js';
import { ConfigLoader } from './services/environment-settings/ConfigLoader.js';
import { GlobalServiceContainer } from './services/GlobalServiceContainer.js';
import { Logger } from './services/Logger.js';

const config = ConfigLoader.load();

config.bots.forEach(botConfig => {
    try {
        const logger = new Logger('App');

        const globalServices = new GlobalServiceContainer(config.global);
        const botServices = new BotServiceContainer(globalServices, botConfig);

        const featureService = botServices.featureService;
        const client = botServices.generativeChatClient;
        const settings = botServices.configurationService;

        logger.info(`Starting bot ${botConfig.botId} in ${botConfig.mode} mode...`);

        // Top-level awaits are not compatible with Parcel/Pkg. Do not replace with an await.
        featureService.loadFeatures().then(() => {
            client.login();
        }).catch((error) => {
            logger.error(`Failed to load supported features for bot ${botConfig.botId}.`
                + ` Check your workflows/workflow permissions and restart ${settings.applicationName}:`, error);
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes('botId is required')) {
            console.error(`Failed to initialize bot: ${error.message}. Please check your config.jsonc file.`);
        } else {
            throw error;
        }
    }
});
