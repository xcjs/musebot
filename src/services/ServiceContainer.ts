import { Client as DiscordClient, GatewayIntentBits, Partials } from 'discord.js';

import { Automatic1111ReplyService } from './clients/chat/discord/automatic1111/Automatic1111ReplyService.js';
import { DiscordAutomatic1111Client } from './clients/chat/discord/automatic1111/DiscordAutomatic1111Client.js';
import { DiscordEasyDiffusionClient } from './clients/chat/discord/easy-diffusion/DiscordEasyDiffusionClient.js';
import { EasyDiffusionReplyService } from './clients/chat/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { DiscordConstants } from './clients/chat/discord/enums/DiscordConstants.js';
import { DiscordOllamaClient } from './clients/chat/discord/ollama/DiscordOllamaClient.js';
import { OllamaReplyService } from './clients/chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from './clients/chat/discord/ollama/OllamaStreamingReplyService.js';
import { ReplyService } from './clients/chat/discord/replies/ReplyService.js';
import { TypingService } from './clients/chat/discord/TypingService.js';
import { Automatic1111Client } from './clients/images/automatic1111/Automatic1111Client.js';
import { EasyDiffusionClient } from './clients/images/easy-diffusion/EasyDiffusionClient.js';
import { OllamaClient } from './clients/text/ollama/OllamaClient.js';
import { EnvironmentSettings } from './EnvironmentSettings.js';
import { FeatureService } from './features/FeatureService.js';
import { IFeatureService } from './features/IFeatureService.js';
import { IEnvironmentSettings } from './IEnvironmentSettings.js';
import { IServiceContainer } from './IServiceContainer.js';
import { TaskQueue } from './tasks/TaskQueue.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';
import { ITypingService } from './clients/chat/ITypingService.js';
import { IGenerativeChatClient } from './clients/chat/IGenerativeChatClient.js';
import { BotFunction } from '../enums/BotFunction.js';
import { StableDiffusionApiType } from './clients/images/stable-diffusion/enums/StableDiffusionApiType.js';
import { IReplyService } from './clients/chat/IReplyService.js';

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

    #taskQueue: ITaskQueue;
    get taskQueue(): ITaskQueue {
        return this.#taskQueue;
    }

    #typingService: ITypingService;
    get typingService(): ITypingService {
        return this.#typingService;
    }

    #discordClient: DiscordClient;
    get discordClient(): DiscordClient {
        return this.#discordClient;
    }

    #generativeChatClient: IGenerativeChatClient;
    get generativeChatClient(): IGenerativeChatClient {
        return this.#generativeChatClient;
    }

    // Transitives ------------------------------------------------------------/

    get replyService(): IReplyService {
        return new ReplyService(this);
    }

    get automatic1111Client(): Automatic1111Client {
        return new Automatic1111Client(this);
    }

    get automatic1111ReplyService(): Automatic1111ReplyService {
        return new Automatic1111ReplyService(this);
    }

    get easyDiffusionClient(): EasyDiffusionClient {
        return new EasyDiffusionClient(this);
    }

    get easyDiffusionReplyService(): EasyDiffusionReplyService {
        return new EasyDiffusionReplyService(this);
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

        switch (this.#environmentSettings.botFunction) {
            case BotFunction.Images:
                switch (this.#environmentSettings.stableDiffusionApiType) {
                    case StableDiffusionApiType.Automatic1111:
                        this.#generativeChatClient = new DiscordAutomatic1111Client(this);
                        break;
                    case StableDiffusionApiType.EasyDiffusion:
                        this.#generativeChatClient = new DiscordEasyDiffusionClient(this);
                        break;
                }
                break;
            case BotFunction.Text:
                this.#generativeChatClient = new DiscordOllamaClient(this);
                break;
        }
    }
}
