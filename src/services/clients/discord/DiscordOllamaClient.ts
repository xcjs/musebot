import { Message } from 'discord.js';
import { Logger } from 'meklog';

import { EnvironmentSettings } from '../../../models/EnvironmentSettings.js';
import { TypingService } from './services/TypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';

export class DiscordOllamaClient extends BaseDiscordClient {
    #conversation: Array<Message> = [];

    constructor(environmentSettings: EnvironmentSettings, typingService: TypingService) {
        super(environmentSettings, typingService);

        this.environmentSettings = environmentSettings;
        this.typingService = typingService;

        this.logger = new Logger(this.environmentSettings.isProduction, 'DiscordOllamaClient');
    }
}
