import { Client as DiscordClient, GatewayIntentBits, Partials } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../EnvironmentSettings.js';
import { TypingService } from './services/TypingService.js';
import { DiscordConstants } from './enums/DiscordConstants.js';
import { FeatureService } from '../../features/FeatureService.js';
import { TaskQueue } from '../../tasks/services/TaskQueue.js';
import { ReplyService } from './ReplyService.js';

export class BaseDiscordClient {
    protected environmentSettings: EnvironmentSettings;
    protected taskQueue: TaskQueue;
    protected replyService: ReplyService;
    protected typingService: TypingService;
    protected featureService: FeatureService;

    protected client: DiscordClient;
    protected logger;

    constructor(environmentSettings: EnvironmentSettings, taskQueue: TaskQueue) {
        this.environmentSettings = environmentSettings;
        this.taskQueue = taskQueue;
        this.typingService = new TypingService(environmentSettings, taskQueue);
        this.featureService = new FeatureService(environmentSettings);

        this.client = new DiscordClient({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent
            ],
            allowedMentions: { users: [], roles: [], repliedUser: false },
            partials: [
                Partials.Channel
            ],
            shards: DiscordConstants.ShardCountAuto
        });

        this.replyService = new ReplyService(environmentSettings, this.client);

        this.logger = new Logger(this.environmentSettings.isProduction, 'BaseDiscordClient');
    }

    login() {
        this.logger(LogLevel.Info, 'Performing client login...');
        this.client.login(this.environmentSettings.discordToken);
    }
}
