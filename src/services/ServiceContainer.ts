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
import { DecreaseGuidanceScaleRenderTask as A1DecreaseGuidanceScaleRenderTask } from './clients/images/automatic1111/tasks/DecreaseGuidanceScaleRenderTask.js';
import { DecreaseGuidanceScaleRenderTask as EdDecreaseGuidanceScaleRenderTask } from './clients/images/easy-diffusion/tasks/DecreaseGuidanceScaleRenderTask.js';
import { IExpandPromptTask } from './clients/images/tasks/IExpandPromptTask.js';
import { SupportedFeature } from './features/enum/SupportedFeature.js';
import { IncreaseGuidanceScaleRenderTask as A1IncreaseGuidanceScaleRenderTask } from './clients/images/automatic1111/tasks/IncreaseGuidanceScaleRenderTask.js';
import { IncreaseGuidanceScaleRenderTask as EdIncreaseGuidanceScaleRenderTask } from './clients/images/easy-diffusion/tasks/IncreaseGuidanceScaleRenderTask.js';
import { IIncreaseGuidanceScaleRenderTask } from './clients/images/tasks/IIncreaseGuidanceScaleRenderTask.js';
import { IJsonRenderTask } from './clients/images/tasks/IJsonRenderTask.js';
import { JsonRenderTask as A1JsonRenderTask } from './clients/images/automatic1111/tasks/JsonRenderTask.js';
import { JsonRenderTask as EdJsonRenderTask } from './clients/images/easy-diffusion/tasks/JsonRenderTask.js';
import { IPromptRenderTask } from './clients/images/tasks/IPromptRenderTask.js';
import { PromptRenderTask as A1PromptRenderTask } from './clients/images/automatic1111/tasks/PromptRenderTask.js';
import { PromptRenderTask as EdPromptRenderTask } from './clients/images/easy-diffusion/tasks/PromptRenderTask.js';
import { IRandomRenderTask } from './clients/images/tasks/IRandomRenderTask.js';
import { RandomRenderTask as A1RandomRenderTask } from './clients/images/automatic1111/tasks/RandomRenderTask.js';
import { RandomRenderTask as EdRandomRenderTask } from './clients/images/easy-diffusion/tasks/RandomRenderTask.js';
import { IRetryRenderTask } from './clients/images/tasks/IRetryRenderTask.js';
import { RetryRenderTask as A1RetryRenderTask } from './clients/images/automatic1111/tasks/RetryRenderTask.js';
import { RetryRenderTask as EdRetryRenderTask } from './clients/images/easy-diffusion/tasks/RetryRenderTask.js';
import { IShowSourceTask } from './clients/images/tasks/IShowSourceTask.js';
import { ShowSourceTask as A1ShowSourceTask } from './clients/images/automatic1111/tasks/ShowSourceTask.js';
import { ShowSourceTask as EdShowSourceTask } from './clients/images/easy-diffusion/tasks/ShowSourceTask.js';
import { IUpscaleRenderTask } from './clients/images/tasks/IUpscaleRenderTask.js';
import { UpscaleRenderTask as A1UpscaleRenderTask } from './clients/images/automatic1111/tasks/UpscaleRenderTask.js';
import { UpscaleRenderTask as EdUpscaleRenderTask } from './clients/images/easy-diffusion/tasks/UpscaleRenderTask.js';
import { IPromptResponseTask } from './clients/text/tasks/IPromptResponseTask.js';
import { PromptResponseTask } from './clients/text/ollama/tasks/PromptResponseTask.js';

export class ServiceContainer implements IServiceContainer {
    #taskNotConfiguredError = 'The task you are attempting to instantiate is not supported by your current configuration.';

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

    // Factories --------------------------------------------------------------/

    getAttachRenderTask(
        interaction: ButtonInteraction | Message,
        prompt: string,
        content: string | null = null,
        isEdit: boolean = false): IAttachRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.ImageGeneration)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                return new A1AttachRenderTask(this, interaction, prompt, content, isEdit);
            case StableDiffusionApiType.EasyDiffusion:
                return new EdAttachRenderTask(this, interaction, prompt, content, isEdit);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getDecreaseGuidanceScaleRenderTask(interaction: ButtonInteraction): IDecreaseGuidanceScaleRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.ImageGeneration)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                return new A1DecreaseGuidanceScaleRenderTask(this, interaction);
            case StableDiffusionApiType.EasyDiffusion:
                return new EdDecreaseGuidanceScaleRenderTask(this, interaction);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getExpandPromptTask(interaction: ButtonInteraction): IExpandPromptTask {
        if(!this.#featureService.hasFeature(SupportedFeature.ImagesAndText)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                return new A1DecreaseGuidanceScaleRenderTask(this, interaction);
            case StableDiffusionApiType.EasyDiffusion:
                return new EdDecreaseGuidanceScaleRenderTask(this, interaction);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getIncreaseGuidanceScaleRenderTask(interaction: ButtonInteraction): IIncreaseGuidanceScaleRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.ImageGeneration)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                return new A1IncreaseGuidanceScaleRenderTask(this, interaction);
            case StableDiffusionApiType.EasyDiffusion:
                return new EdIncreaseGuidanceScaleRenderTask(this, interaction);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getJsonRenderTask(message: Message): IJsonRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.ImageGeneration)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                return new A1JsonRenderTask(this, message);
            case StableDiffusionApiType.EasyDiffusion:
                return new EdJsonRenderTask(this, message);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getPromptRenderTask(message: Message): IPromptRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.ImageGeneration)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                return new A1PromptRenderTask(this, message);
            case StableDiffusionApiType.EasyDiffusion:
                return new EdPromptRenderTask(this, message);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getRandomRenderTask(interaction: ButtonInteraction): IRandomRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.ImageGeneration)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                return new A1RandomRenderTask(this, interaction);
            case StableDiffusionApiType.EasyDiffusion:
                return new EdRandomRenderTask(this, interaction);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getRetryRenderTask(interaction: ButtonInteraction): IRetryRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.ImageGeneration)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                return new A1RetryRenderTask(this, interaction);
            case StableDiffusionApiType.EasyDiffusion:
                return new EdRetryRenderTask(this, interaction);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getShowSourceTask(interaction: ButtonInteraction): IShowSourceTask {
        if (!this.#featureService.hasFeature(SupportedFeature.ImageGeneration)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                return new A1ShowSourceTask(this, interaction);
            case StableDiffusionApiType.EasyDiffusion:
                return new EdShowSourceTask(this, interaction);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getUpscaleRenderTask(interaction: ButtonInteraction): IUpscaleRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.ImageGeneration)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                return new A1UpscaleRenderTask(this, interaction);
            case StableDiffusionApiType.EasyDiffusion:
                return new EdUpscaleRenderTask(this, interaction);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getPromptResponseTask(message: Message, context: Array<number>): IPromptResponseTask {
        if(!this.#featureService.hasFeature(SupportedFeature.TextGeneration)) {
            throw this.#taskNotConfiguredError;
        }

        return new PromptResponseTask(this, message, context);
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
