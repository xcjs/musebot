import { Client as DiscordClient } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';

export class BaseDiscordClient {
    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;

    protected logger;

    constructor(services: IServiceContainer) {
        this.#discordClient = services.discordClient;
        this.#environmentSettings = services.environmentSettings;

        this.logger = new Logger(this.#environmentSettings.isProduction, 'BaseDiscordClient');
    }

    login() {
        this.logger(LogLevel.Info, 'Performing client login...');
        this.#discordClient.login(this.#environmentSettings.discordToken);
    }
}
