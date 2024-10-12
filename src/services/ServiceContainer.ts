import { Client as DiscordClient, GatewayIntentBits, Partials } from 'discord.js';

import { Automatic1111ReplyService } from './clients/chat/discord/automatic1111/Automatic1111ReplyService';
import { DiscordAutomatic1111Client } from './clients/chat/discord/automatic1111/DiscordAutomatic1111Client';
import { DiscordEasyDiffusionClient } from './clients/chat/discord/easy-diffusion/DiscordEasyDiffusionClient';
import { EasyDiffusionReplyService } from './clients/chat/discord/easy-diffusion/EasyDiffusionReplyService';
import { DiscordConstants } from './clients/chat/discord/enums/DiscordConstants';
import { MessageService } from './clients/chat/discord/MessageService';
import { DiscordOllamaClient } from './clients/chat/discord/ollama/DiscordOllamaClient';
import { OllamaReplyService } from './clients/chat/discord/ollama/OllamaReplyService';
import { OllamaStreamingReplyService } from './clients/chat/discord/ollama/OllamaStreamingReplyService';
import { ReplyService } from './clients/chat/discord/ReplyService';
import { TypingService } from './clients/chat/discord/TypingService';
import { Automatic1111Client } from './clients/images/automatic1111/Automatic1111Client';
import { EasyDiffusionClient } from './clients/images/easy-diffusion/EasyDiffusionClient';
import { OllamaClient } from './clients/text/ollama/OllamaClient';
import { EnvironmentSettings } from './EnvironmentSettings';
import { FeatureService } from './features/FeatureService';
import { IFeatureService } from './features/IFeatureService';
import { IEnvironmentSettings } from './IEnvironmentSettings';
import { IServiceContainer } from './IServiceContainer';
import { TaskQueue } from './tasks/TaskQueue';

export class ServiceContainer implements IServiceContainer {
    // Singletons -------------------------------------------------------------/

    #environmentSettings: IEnvironmentSettings;
    get environmentSettings(): IEnvironmentSettings {
        return this.#environmentSettings;
    }

    #featureService: IFeatureService;
    get featureService(): IFeatureService {
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
