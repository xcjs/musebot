import { BaseMessageOptions, ButtonInteraction, Client as DiscordClient, GatewayIntentBits, Message, MessageReaction, Partials, ReactionEmoji, User } from 'discord.js';

import { BotFunction } from '../enums/BotFunction.js';
import { ComfyUiReplyService } from './clients/chat/discord/comfy-ui/ComfyUiReplyService.js';
import { ActionRowBuilderFactory } from './clients/chat/discord/components/ActionRowBuilderFactory.js';
import { IActionRowBuilderFactory } from './clients/chat/discord/components/IActionRowBuilderFactory.js';
import { DiscordConstants } from './clients/chat/discord/enums/DiscordConstants.js';
import { GenerativeImageChatClient } from './clients/chat/discord/GenerativeImageChatClient.js';
import { GenerativeTextChatClient } from './clients/chat/discord/GenerativeTextChatClient.js';
import { OllamaReplyService } from './clients/chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from './clients/chat/discord/ollama/OllamaStreamingReplyService.js';
import { ReplyService } from './clients/chat/discord/replies/ReplyService.js';
import { TypingService } from './clients/chat/discord/services/TypingService.js';
import { ReplyTask } from './clients/chat/discord/tasks/ReplyTask.js';
import { IGenerativeChatClient } from './clients/chat/IGenerativeChatClient.js';
import { IReplyService } from './clients/chat/IReplyService.js';
import { ITypingService } from './clients/chat/ITypingService.js';
import { IReplyTask } from './clients/chat/tasks/IReplyTask.js';
import { ComfyUiClient } from './clients/images/comfy-ui/ComfyUiClient.js';
import { IWorkflow } from './clients/images/comfy-ui/models/IWorkflow.js';
import { IWorkflowService } from './clients/images/comfy-ui/services/IWorkflowService.js';
import { WorkflowService } from './clients/images/comfy-ui/services/WorkflowService.js';
import { ComfyUiAttachRenderTask } from './clients/images/comfy-ui/tasks/ComfyUiAttachRenderTask.js';
import { ComfyUiDecreaseGuidanceScaleRenderTask } from './clients/images/comfy-ui/tasks/ComfyUiDecreaseGuidanceScaleRenderTask.js';
import { ComfyUiEmojiReactionRenderTask } from './clients/images/comfy-ui/tasks/ComfyUiEmojiReactionRenderTask.js';
import { ComfyUiExpandPromptTask } from './clients/images/comfy-ui/tasks/ComfyUiExpandPromptTask.js';
import { ComfyUiImg2ImgRenderTask } from './clients/images/comfy-ui/tasks/ComfyUiImg2ImgRenderTask.js';
import { ComfyUiIncreaseGuidanceScaleRenderTask } from './clients/images/comfy-ui/tasks/ComfyUiIncreaseGuidanceScaleRenderTask.js';
import { ComfyUiJsonRenderTask } from './clients/images/comfy-ui/tasks/ComfyUiJsonRenderTask.js';
import { ComfyUiRandomRenderTask } from './clients/images/comfy-ui/tasks/ComfyUiRandomRenderTask.js';
import { ComfyUiReplyRenderTask } from './clients/images/comfy-ui/tasks/ComfyUiReplyRenderTask.js';
import { ComfyUiRetryRenderTask } from './clients/images/comfy-ui/tasks/ComfyUiRetryRenderTask.js';
import { ComfyUiShowSourceTask } from './clients/images/comfy-ui/tasks/ComfyUiShowSourceTask.js';
import { ImageHelpService } from './clients/images/help/ImageHelpService.js';
import { StableDiffusionApiType } from './clients/images/stable-diffusion/enums/StableDiffusionApiType.js';
import { IAttachRenderTask } from './clients/images/tasks/IAttachRenderTask.js';
import { IDecreaseGuidanceScaleRenderTask } from './clients/images/tasks/IDecreaseGuidanceScaleRenderTask.js';
import { IEmojiReactionRenderTask } from './clients/images/tasks/IEmojiReactionRenderTask.js';
import { IExpandPromptTask } from './clients/images/tasks/IExpandPromptTask.js';
import { IIncreaseGuidanceScaleRenderTask } from './clients/images/tasks/IIncreaseGuidanceScaleRenderTask.js';
import { IJsonRenderTask } from './clients/images/tasks/IJsonRenderTask.js';
import { IRandomRenderTask } from './clients/images/tasks/IRandomRenderTask.js';
import { IReplyRenderTask } from './clients/images/tasks/IReplyRenderTask.js';
import { IRetryRenderTask } from './clients/images/tasks/IRetryRenderTask.js';
import { IShowSourceTask } from './clients/images/tasks/IShowSourceTask.js';
import { TextHelpService } from './clients/text/help/TextHelpService.js';
import { OllamaClient } from './clients/text/ollama/OllamaClient.js';
import { EmojiResponseTask } from './clients/text/ollama/tasks/EmojiResponseTask.js';
import { PromptResponseTask } from './clients/text/ollama/tasks/PromptResponseTask.js';
import { IEmojiResponseTask } from './clients/text/tasks/IEmojiResponseTask.js';
import { IPromptResponseTask } from './clients/text/tasks/IPromptResponseTask.js';
import { EnvironmentSettings } from './environment-settings/EnvironmentSettings.js';
import { IEnvironmentSettings } from './environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from './features/enum/SupportedFeature.js';
import { FeatureService } from './features/FeatureService.js';
import { IFeatureService } from './features/IFeatureService.js';
import { IHelpService } from './help/IHelpService.js';
import { IServiceContainer } from './IServiceContainer.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';
import { TaskQueue } from './tasks/TaskQueue.js';

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

    #helpService: IHelpService;
    get helpService(): IHelpService {
        return this.#helpService;
    }

    #workflowService: IWorkflowService;
    get workflowService(): IWorkflowService {
        return this.#workflowService;
    }

    // Transitives ------------------------------------------------------------/

    get replyService(): IReplyService {
        return new ReplyService(this);
    }

    get comfyUiClient(): ComfyUiClient {
        return new ComfyUiClient(this);
    }

    get comfyUiReplyService(): ComfyUiReplyService {
        return new ComfyUiReplyService(this);
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

    get actionRowBuilderFactory(): IActionRowBuilderFactory {
        return new ActionRowBuilderFactory();
    }

    // Factories --------------------------------------------------------------/
    getReplyTask(
        interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions
        ): IReplyTask {
        return new ReplyTask(this, interaction, reply);
    }

    getAttachRenderTask(
        interaction: ButtonInteraction | Message,
        prompt: string,
        content: string | null = null): IAttachRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.ComfyUI:
                return new ComfyUiAttachRenderTask(this, interaction, { content }, prompt);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getDecreaseGuidanceScaleRenderTask(interaction: ButtonInteraction): IDecreaseGuidanceScaleRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.ComfyUI:
                return new ComfyUiDecreaseGuidanceScaleRenderTask(this, interaction);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getEmojiReactionRenderTask(interaction: Message, emoji: ReactionEmoji, userOverride: User): IEmojiReactionRenderTask {
        if(!this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            || !this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            throw this.#taskNotConfiguredError;
        }

        switch(this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.ComfyUI:
                return new ComfyUiEmojiReactionRenderTask(this, interaction, emoji, userOverride);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getExpandPromptTask(interaction: ButtonInteraction): IExpandPromptTask {
        if(!this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.ComfyUI:
                return new ComfyUiExpandPromptTask(this, interaction);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getImg2ImgRenderTask(interaction: ButtonInteraction, workflow: IWorkflow) {
        if(!this.#featureService.hasFeature(SupportedFeature.Img2Img)) {
            throw this.#taskNotConfiguredError;
        }

        switch(this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.ComfyUI:
                return new ComfyUiImg2ImgRenderTask(this, interaction, workflow);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getIncreaseGuidanceScaleRenderTask(interaction: ButtonInteraction): IIncreaseGuidanceScaleRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.ComfyUI:
                return new ComfyUiIncreaseGuidanceScaleRenderTask(this, interaction);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getJsonRenderTask(message: Message): IJsonRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.ComfyUI:
                return new ComfyUiJsonRenderTask(this, message);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getRandomRenderTask(interaction: ButtonInteraction): IRandomRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.ComfyUI:
                return new ComfyUiRandomRenderTask(this, interaction);
                default:
                    throw this.#taskNotConfiguredError;
                }
            }

    getReplyRenderTask(message: Message): IReplyRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.ComfyUI:
                return new ComfyUiReplyRenderTask(this, message);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getRetryRenderTask(interaction: ButtonInteraction): IRetryRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.ComfyUI:
                return new ComfyUiRetryRenderTask(this, interaction);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getShowSourceTask(interaction: ButtonInteraction): IShowSourceTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            throw this.#taskNotConfiguredError;
        }

        switch (this.#environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.ComfyUI:
                return new ComfyUiShowSourceTask(this, interaction);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getPromptResponseTask(message: Message, context: Array<number>): IPromptResponseTask {
        if(!this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            throw this.#taskNotConfiguredError;
        }

        return new PromptResponseTask(this, message, context);
    }

    getEmojiResponseTask(reaction: MessageReaction, user: User, context: Array<number>): IEmojiResponseTask {
        if(!this.featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            throw this.#taskNotConfiguredError;
        }

        return new EmojiResponseTask(this, reaction, user, context);
    }

    constructor() {
        // Singletons instantiated here.
        this.#environmentSettings = new EnvironmentSettings();
        this.#workflowService = new WorkflowService(this);
        this.#featureService = new FeatureService(this);
        this.#taskQueue = new TaskQueue(this);
        this.#typingService = new TypingService(this);

        this.#discordClient = new DiscordClient({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent
            ],
            allowedMentions: { users: [], roles: [], repliedUser: false },
            partials: [
                Partials.Message,
                Partials.Channel,
                Partials.Reaction
            ],
            shards: DiscordConstants.ShardCountAuto
        });

        switch (this.#environmentSettings.botFunction) {
            case BotFunction.Images:
                this.#helpService = new ImageHelpService(this);
                this.#generativeChatClient = new GenerativeImageChatClient(this);
                break;
            case BotFunction.Text:
                this.#helpService = new TextHelpService(this);
                this.#generativeChatClient = new GenerativeTextChatClient(this);
                break;
        }
    }
}
