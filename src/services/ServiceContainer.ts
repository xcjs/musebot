import { Client as DiscordClient, GatewayIntentBits, Partials } from 'discord.js';
import { EnvironmentSettings } from './EnvironmentSettings';
import { IServiceContainer } from './IServiceContainer';
import { MessageService } from './clients/discord/services/MessageService';
import { TypingService } from './clients/discord/services/TypingService';
import { FeatureService } from './features/FeatureService';
import { TaskQueue } from './tasks/services/TaskQueue';
import { DiscordAutomatic1111Client } from './clients/discord/automatic1111/DiscordAutomatic1111Client';
import { Automatic1111Client } from './clients/automatic1111/Automatic1111Client';
import { DiscordConstants } from './clients/discord/enums/DiscordConstants';
import { EasyDiffusionClient } from './clients/easy-diffusion/EasyDiffusionClient';
import { DiscordEasyDiffusionClient } from './clients/discord/easy-diffusion/DiscordEasyDiffusionClient';
import { OllamaClient } from './clients/ollama/OllamaClient';
import { DiscordOllamaClient } from './clients/discord/ollama/DiscordOllamaClient';

export class ServiceContainer implements IServiceContainer {
    // Singletons -------------------------------------------------------------/

    #environmentSettings: EnvironmentSettings;
    get environmentSettings(): EnvironmentSettings {
        return this.#environmentSettings;
    }

    #featureService: FeatureService;
    get featureService(): FeatureService {
        return this.#featureService;
    }

    #taskQueue: TaskQueue;
    get taskQueue(): TaskQueue {
        return this.#taskQueue;
    }

    #typingService: TypingService;
    get typingService(): TypingService {
        return this.#typingService;
    }

    #discordClient: DiscordClient;
    get discordClient(): DiscordClient {
        return this.#discordClient;
    }

    // Transitives ------------------------------------------------------------/

    get messageService(): MessageService {
        return new MessageService();
    }

    get automatic1111Client(): Automatic1111Client {
        return new Automatic1111Client(this);
    }

    get discordAutomatic1111Client(): DiscordAutomatic1111Client {
        return new DiscordAutomatic1111Client(this);
    }

    get easyDiffusionClient(): EasyDiffusionClient {
        return new EasyDiffusionClient(this);
    }

    get discordEasyDiffusionClient(): DiscordEasyDiffusionClient {
        return new DiscordEasyDiffusionClient(this);
    }

    get ollamaClient(): OllamaClient {
        return new OllamaClient(this);
    }

    get discordOllamaClient(): DiscordOllamaClient {
        return new DiscordOllamaClient(this);
    }

    constructor() {
        // Singletons instantiated here.
        this.#environmentSettings = new EnvironmentSettings();
        this.#featureService = new FeatureService(this);
        this.#taskQueue = new TaskQueue(this);

        this.#discordClient = new DiscordClient({
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
    }
}
