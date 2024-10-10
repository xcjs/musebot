import { Client as DiscordClient, GatewayIntentBits, Partials } from 'discord.js';

import { EnvironmentSettings } from './EnvironmentSettings.js';
import { IServiceContainer } from './IServiceContainer.js';
import { MessageService } from './clients/discord/services/MessageService.js';
import { TypingService } from './clients/discord/services/TypingService.js';
import { FeatureService } from './features/FeatureService.js';
import { TaskQueue } from './tasks/services/TaskQueue.js';
import { DiscordAutomatic1111Client } from './clients/discord//automatic1111/DiscordAutomatic1111Client.js';
import { Automatic1111Client } from './clients/automatic1111/Automatic1111Client.js';
import { DiscordConstants } from './clients/discord/enums/DiscordConstants.js';
import { EasyDiffusionClient } from './clients/easy-diffusion/EasyDiffusionClient.js';
import { DiscordEasyDiffusionClient } from './clients/discord/easy-diffusion/DiscordEasyDiffusionClient.js';
import { OllamaClient } from './clients/ollama/OllamaClient.js';
import { DiscordOllamaClient } from './clients/discord/ollama/DiscordOllamaClient.js';
import { ReplyService } from './clients/discord/services/ReplyService.js';
import { Automatic1111ReplyService } from './clients/discord/automatic1111/Automatic1111ReplyService.js';
import { OllamaReplyService } from './clients/discord/ollama/OllamaReplyService.js';
import { EasyDiffusionReplyService } from './clients/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { OllamaStreamingReplyService } from './clients/discord/ollama/OllamaStreamingReplyService.js';
import { IEnvironmentSettings } from './IEnvironmentSettings.js';

export class ServiceContainer implements IServiceContainer {
    // Singletons -------------------------------------------------------------/

    #environmentSettings: IEnvironmentSettings;
    get environmentSettings(): IEnvironmentSettings {
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

    get replyService(): ReplyService {
        return new ReplyService(this);
    }

    get automatic1111Client(): Automatic1111Client {
        return new Automatic1111Client(this);
    }

    get automatic1111ReplyService(): Automatic1111ReplyService {
        return new Automatic1111ReplyService(this);
    }

    get discordAutomatic1111Client(): DiscordAutomatic1111Client {
        return new DiscordAutomatic1111Client(this);
    }

    get easyDiffusionClient(): EasyDiffusionClient {
        return new EasyDiffusionClient(this);
    }

    get easyDiffusionReplyService(): EasyDiffusionReplyService {
        return new EasyDiffusionReplyService(this);
    }

    get discordEasyDiffusionClient(): DiscordEasyDiffusionClient {
        return new DiscordEasyDiffusionClient(this);
    }

    get ollamaClient(): OllamaClient {
        return new OllamaClient(this);
    }

    get ollamaReplyService(): OllamaReplyService {
        return new OllamaReplyService(this);
    }

    get ollamaStreamingReplyService(): OllamaStreamingReplyService {
        return new OllamaStreamingReplyService(this);
    }

    get discordOllamaClient(): DiscordOllamaClient {
        return new DiscordOllamaClient(this);
    }

    constructor() {
        // Singletons instantiated here.
        this.#environmentSettings = new EnvironmentSettings();
        this.#featureService = new FeatureService(this);
        this.#taskQueue = new TaskQueue(this);
        this.#typingService = new TypingService(this);

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
