import { Logger } from 'meklog';

import { Message } from 'discord.js';
import { EnvironmentSettings } from '../../../models/EnvironmentSettings';
import { TypingService } from './services/TypingService';
import { BaseDiscordClient } from './BaseDiscordClient';

export class DiscordOllamaClient extends BaseDiscordClient {
    #conversation: Array<Message> = [];

    constructor(environmentSettings: EnvironmentSettings, typingService: TypingService) {
        super(environmentSettings, typingService);

        this.environmentSettings = environmentSettings;
        this.typingService = typingService;

        this.logger = new Logger(this.environmentSettings.isProduction, 'DiscordOllamaClient');
    }
}
