import { Client } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../models/EnvironmentSettings';
import { TypingService } from './services/TypingService';

export class BaseDiscordClient {
    protected environmentSettings: EnvironmentSettings;
    protected typingService: TypingService;

    protected logger;

    protected client: Client;

    constructor(environmentSettings: EnvironmentSettings, typingService: TypingService) {
        this.environmentSettings = environmentSettings;
        this.typingService = typingService;

        this.logger = new Logger(this.environmentSettings.isProduction, 'BaseDiscordClient');
    }

    login() {
        this.logger(LogLevel.Info, 'Performing client login...');
        this.client.login(this.environmentSettings.discordToken);
    }
}
