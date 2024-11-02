import { Client as DiscordClient } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { IGenerativeChatClient } from '../IGenerativeChatClient.js';

export class BaseDiscordClient implements IGenerativeChatClient {
    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;

    protected logger;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;

        this.logger = new Logger(this.#environmentSettings.isProduction, 'BaseDiscordClient');
    }

    async login(): Promise<void> {
        this.logger(LogLevel.Info, 'Performing client login...');
        await this.#discordClient.login(this.#environmentSettings.discordToken);
    }
}
