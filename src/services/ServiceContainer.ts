import { ButtonInteraction, Client as DiscordClient, GatewayIntentBits, Message, Partials } from 'discord.js';

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
import { AttachRenderTask as A1AttachRenderTask } from './clients/images/automatic1111/tasks/AttachRenderTask.js';
import { AttachRenderTask as EdAttachRenderTask } from './clients/images/easy-diffusion/tasks/AttachRenderTask.js';
import { IAttachRenderTask } from './clients/images/tasks/IAttachRenderTask.js';
import { IDecreaseGuidanceScaleRenderTask } from './clients/images/tasks/IDecreaseGuidanceScaleRenderTask.js';
import { IExpandPromptTask } from './clients/images/tasks/IExpandPromptTask.js';
import { IIncreaseGuidanceScaleRenderTask } from './clients/images/tasks/IIncreaseGuidanceScaleRenderTask.js';
import { IJsonRenderTask } from './clients/images/tasks/IJsonRenderTask.js';
import { IPromptRenderTask } from './clients/images/tasks/IPromptRenderTask.js';
import { IRandomRenderTask } from './clients/images/tasks/IRandomRenderTask.js';
import { IRetryRenderTask } from './clients/images/tasks/IRetryRenderTask.js';
import { IShowSourceTask } from './clients/images/tasks/IShowSourceTask.js';
import { IUpscaleRenderTask } from './clients/images/tasks/IUpscaleRenderTask.js';

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

    #attachRenderTask: IAttachRenderTask;
    get attachRenderTask(): IAttachRenderTask {
        return this.#attachRenderTask;
    }

    #decreaseGuidanceScaleRenderTask: IDecreaseGuidanceScaleRenderTask;
    get decreaseGuidanceScaleRenderTask(): IDecreaseGuidanceScaleRenderTask {
        return this.#decreaseGuidanceScaleRenderTask;
    }

    #expandPromptTask: IExpandPromptTask;
    get expandPromptTask(): IExpandPromptTask {
        return this.#expandPromptTask;
    }

    #increaseGuidanceScaleRenderTask: IIncreaseGuidanceScaleRenderTask;
    get increaseGuidanceScaleRenderTask(): IIncreaseGuidanceScaleRenderTask {
        return this.#increaseGuidanceScaleRenderTask;
    }

    #jsonRenderTask: IJsonRenderTask;
    get jsonRenderTask(): IJsonRenderTask {
        return this.#jsonRenderTask;
    }

    #promptRenderTask: IPromptRenderTask;
    get promptRenderTask(): IPromptRenderTask {
        return this.#promptRenderTask;
    }

    #randomRenderTask: IRandomRenderTask;
    get randomRenderTask(): IRandomRenderTask {
        return this.#randomRenderTask;
    }

    #retryRenderTask: IRetryRenderTask;
    get retryRenderTask(): IRetryRenderTask {
        return this.#retryRenderTask;
    }

    #showSourceTask: IShowSourceTask;
    get showSourceTask(): IShowSourceTask {
        return this.#showSourceTask;
    }

    #upscaleRenderTask: IUpscaleRenderTask;
    get upscaleRenderTask(): IUpscaleRenderTask {
        return this.#upscaleRenderTask;
    }

    // Factories --------------------------------------------------------------/

    getAttachRenderTask(
        interaction: ButtonInteraction | Message,
        prompt: string,
        content: string | null = null,
        isEdit: boolean = false): IAttachRenderTask {
        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                return new A1AttachRenderTask(this, interaction, prompt, content, isEdit);
            case StableDiffusionApiType.EasyDiffusion:
                return new EdAttachRenderTask(this, interaction, prompt, content, isEdit);
        }
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
