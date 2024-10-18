import { Client as DiscordClient } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IGenerativeChatClient } from '../IGenerativeChatClient.js';
import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';

export class BaseDiscordClient implements IGenerativeChatClient {
    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;

    protected logger;

    constructor(services: IServiceContainer) {
        this.#discordClient = services.discordClient;
        this.#environmentSettings = services.environmentSettings;

        this.logger = new Logger(this.#environmentSettings.isProduction, 'BaseDiscordClient');
    }

    async login(): Promise<void> {
        this.logger(LogLevel.Info, 'Performing client login...');
        await this.#discordClient.login(this.#environmentSettings.discordToken);
    }
}
