import {
    BaseMessageOptions,
    ButtonInteraction,
    Client as DiscordClient,
    GatewayIntentBits,
    Message as DiscordMessage,
    MessageReaction,
    Partials,
    ReactionEmoji,
    User} from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { BotFunction } from '../enums/BotFunction.js';
import { BotInteraction } from '../enums/BotInteraction.js';
import { getRandomArrayEntry } from '../utilities/random-utilities.js';
import { ComfyUiReplyService } from './clients/chat/discord/comfy-ui/ComfyUiReplyService.js';
import { ActionRowBuilderFactory } from './clients/chat/discord/components/ActionRowBuilderFactory.js';
import { IActionRowBuilderFactory } from './clients/chat/discord/components/IActionRowBuilderFactory.js';
import { DiscordConstants } from './clients/chat/discord/enums/DiscordConstants.js';
import { GenerativeChatClient } from './clients/chat/discord/GenerativeChatClient.js';
import { GenerativeMediaChatClient } from './clients/chat/discord/GenerativeMediaChatClient.js';
import { OllamaReplyService } from './clients/chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from './clients/chat/discord/ollama/OllamaStreamingReplyService.js';
import { ReplyService } from './clients/chat/discord/replies/ReplyService.js';
import { TypingService } from './clients/chat/discord/services/TypingService.js';
import { ReplyTask } from './clients/chat/discord/tasks/ReplyTask.js';
import { IGenerativeChatClient } from './clients/chat/IGenerativeChatClient.js';
import { IReplyService } from './clients/chat/IReplyService.js';
import { ITypingService } from './clients/chat/ITypingService.js';
import { IMentionTask } from './clients/chat/tasks/IMentionTask.js';
import { IReplyTask } from './clients/chat/tasks/IReplyTask.js';
import { TextHelpService } from './clients/llm/help/TextHelpService.js';
import { OllamaClient } from './clients/llm/ollama/OllamaClient.js';
import { OllamaEmojiResponseTask } from './clients/llm/ollama/tasks/OllamaEmojiResponseTask.js';
import { OllamaPromptResponseTask } from './clients/llm/ollama/tasks/OllamaPromptResponseTask.js';
import { IEmojiResponseTask } from './clients/llm/tasks/IEmojiResponseTask.js';
import { IPromptResponseTask } from './clients/llm/tasks/IPromptResponseTask.js';
import { ComfyUiClient } from './clients/media/comfy-ui/ComfyUiClient.js';
import { IWorkflow } from './clients/media/comfy-ui/models/IWorkflow.js';
import { IWorkflowService } from './clients/media/comfy-ui/services/IWorkflowService.js';
import { IWorkflowMutator } from './clients/media/comfy-ui/services/workflow-mutators/IWorkflowMutator.js';
import { MentionImageMutator } from './clients/media/comfy-ui/services/workflow-mutators/MentionImageMutator.js';
import { WorkflowService } from './clients/media/comfy-ui/services/WorkflowService.js';
import { ComfyUiAttachRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiAttachRenderTask.js';
import { ComfyUiDecreaseGuidanceScaleRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiDecreaseGuidanceScaleRenderTask.js';
import { ComfyUiEmojiReactionRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiEmojiReactionRenderTask.js';
import { ComfyUiExpandPromptTask } from './clients/media/comfy-ui/tasks/ComfyUiExpandPromptTask.js';
import { ComfyUiImg2ImgRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiImg2ImgRenderTask.js';
import { ComfyUiIncreaseGuidanceScaleRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiIncreaseGuidanceScaleRenderTask.js';
import { ComfyUiJsonRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiJsonRenderTask.js';
import { ComfyUiMentionTask } from './clients/media/comfy-ui/tasks/ComfyUiMentionTask.js';
import { ComfyUiRandomRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiRandomRenderTask.js';
import { ComfyUiReplyAudioTask } from './clients/media/comfy-ui/tasks/ComfyUiReplyAudioTask.js';
import { ComfyUiReplyRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiReplyRenderTask.js';
import { ComfyUiRetryAudioTask } from './clients/media/comfy-ui/tasks/ComfyUiRetryAudioTask.js';
import { ComfyUiRetryRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiRetryRenderTask.js';
import { ComfyUiShowSourceTask } from './clients/media/comfy-ui/tasks/ComfyUiShowSourceTask.js';
import { ImageHelpService } from './clients/media/help/ImageHelpService.js';
import { IAttachRenderTask } from './clients/media/tasks/IAttachRenderTask.js';
import { IDecreaseGuidanceScaleRenderTask } from './clients/media/tasks/IDecreaseGuidanceScaleRenderTask.js';
import { IEmojiReactionRenderTask } from './clients/media/tasks/IEmojiReactionRenderTask.js';
import { IExpandPromptTask } from './clients/media/tasks/IExpandPromptTask.js';
import { IIncreaseGuidanceScaleRenderTask } from './clients/media/tasks/IIncreaseGuidanceScaleRenderTask.js';
import { IJsonRenderTask } from './clients/media/tasks/IJsonRenderTask.js';
import { IMessageReplyTask } from './clients/media/tasks/IMessageReplyTask.js';
import { IRandomRenderTask } from './clients/media/tasks/IRandomRenderTask.js';
import { IReplyRenderTask } from './clients/media/tasks/IReplyRenderTask.js';
import { IRetryRenderTask } from './clients/media/tasks/IRetryRenderTask.js';
import { IShowSourceTask } from './clients/media/tasks/IShowSourceTask.js';
import { EnvironmentSettings } from './environment-settings/EnvironmentSettings.js';
import { IEnvironmentSettings } from './environment-settings/IEnvironmentSettings.js';
import { ContentTypeService } from './features/ContentTypeService.js';
import { SupportedFeature } from './features/enum/SupportedFeature.js';
import { FeatureService } from './features/FeatureService.js';
import { IContentTypeService } from './features/IContentTypeService.js';
import { IFeatureService } from './features/IFeatureService.js';
import { IHelpService } from './help/IHelpService.js';
import { ILogger } from './ILogger.js';
import { IServiceContainer } from './IServiceContainer.js';
import { Logger } from './Logger.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';
import { TaskQueue } from './tasks/TaskQueue.js';

export class ServiceContainer implements IServiceContainer {
    #taskNotConfiguredError = new Error('The task you are attempting to instantiate is not supported by your current configuration.');

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

    // Transients -------------------------------------------------------------/

    get contentTypeService(): IContentTypeService {
        return new ContentTypeService;
    }

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
    getLogger(prefix: string): ILogger {
        return new Logger(prefix);
    }

    getReplyTask(
        interaction: DiscordMessage | ButtonInteraction,
        reply: BaseMessageOptions
        ): IReplyTask {
        return new ReplyTask(this, interaction, reply);
    }

    getMessageReplyTask(message: DiscordMessage): IMessageReplyTask {
        if (this.#featureService.hasFeature(SupportedFeature.Txt2Audio)
            || this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            || this.#featureService.hasFeature(SupportedFeature.Txt2Music)
            || this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            return new ComfyUiReplyRenderTask(this, message);
        } else if (this.#featureService.hasFeature(SupportedFeature.Txt2Music)) {
            return new ComfyUiReplyAudioTask(this, message);
        } else {
            throw this.#taskNotConfiguredError;
        }
    }

    getAttachRenderTask(
        interaction: ButtonInteraction | DiscordMessage,
        prompt: string,
        content: string | null = null): IAttachRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            throw this.#taskNotConfiguredError;
        }

        return new ComfyUiAttachRenderTask(this, interaction, { content }, prompt);
    }

    getDecreaseGuidanceScaleRenderTask(interaction: ButtonInteraction): IDecreaseGuidanceScaleRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            throw this.#taskNotConfiguredError;
        }

        return new ComfyUiDecreaseGuidanceScaleRenderTask(this, interaction);
    }

    getEmojiReactionRenderTask(interaction: DiscordMessage, emoji: ReactionEmoji, userOverride: User): IEmojiReactionRenderTask {
        if(!this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            || !this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            throw this.#taskNotConfiguredError;
        }

        return new ComfyUiEmojiReactionRenderTask(this, interaction, emoji, userOverride);
    }

    getExpandPromptTask(interaction: ButtonInteraction): IExpandPromptTask {
        if(!this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            throw this.#taskNotConfiguredError;
        }

        return new ComfyUiExpandPromptTask(this, interaction);
    }

    getImg2ImgRenderTask(interaction: ButtonInteraction, workflow: IWorkflow) {
        if(!this.#featureService.hasFeature(SupportedFeature.Img2Img)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            throw this.#taskNotConfiguredError;
        }

        return new ComfyUiImg2ImgRenderTask(this, interaction, workflow);
    }

    getIncreaseGuidanceScaleRenderTask(interaction: ButtonInteraction): IIncreaseGuidanceScaleRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            throw this.#taskNotConfiguredError;
        }

        return new ComfyUiIncreaseGuidanceScaleRenderTask(this, interaction);
    }

    getJsonRenderTask(message: DiscordMessage): IJsonRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            throw this.#taskNotConfiguredError;
        }

        return new ComfyUiJsonRenderTask(this, message);
    }

    getRandomRenderTask(interaction: ButtonInteraction): IRandomRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            throw this.#taskNotConfiguredError;
        }

        return new ComfyUiRandomRenderTask(this, interaction);
    }

    getReplyRenderTask(message: DiscordMessage): IReplyRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Audio)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Music)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            throw this.#taskNotConfiguredError;
        }

        if (this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            return new ComfyUiReplyRenderTask(this, message);
        } else if (this.#featureService.hasFeature(SupportedFeature.Txt2Music)) {
            return new ComfyUiReplyAudioTask(this, message);
        } else {
            throw this.#taskNotConfiguredError;
        }
    }

    getRetryRenderTask(interaction: ButtonInteraction): IRetryRenderTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Audio)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Music)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            throw this.#taskNotConfiguredError;
        }

        if(this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            return new ComfyUiRetryRenderTask(this, interaction);
        } else if(this.#featureService.hasFeature(SupportedFeature.Txt2Music)) {
            return new ComfyUiRetryAudioTask(this, interaction);
        } else {
            throw this.#taskNotConfiguredError;
        }
    }

    getShowSourceTask(interaction: ButtonInteraction): IShowSourceTask {
        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            throw this.#taskNotConfiguredError;
        }

        return new ComfyUiShowSourceTask(this, interaction);
    }

    getLlmPromptResponseTask(message: DiscordMessage, context: OllamaMessage[]): IPromptResponseTask {
        if(!this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            throw this.#taskNotConfiguredError;
        }

        return new OllamaPromptResponseTask(this, message, context);
    }

    getLlmEmojiResponseTask(reaction: MessageReaction, user: User, context: OllamaMessage[]): IEmojiResponseTask {
        if(!this.featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            throw this.#taskNotConfiguredError;
        }

        return new OllamaEmojiResponseTask(this, reaction, user, context);
    }

    getMentionTask(message: DiscordMessage): IMentionTask {
        switch(this.#environmentSettings.botFunction) {
            case BotFunction.Chat:

                break;
            case BotFunction.Media:
                return new ComfyUiMentionTask(this, message);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getWorkflowMutator(interaction: BotInteraction, workflow: IWorkflow): IWorkflowMutator {
        const mutators = [
            new MentionImageMutator(this)
        ];

        const supportedMutators = mutators.filter(
            mutator => mutator.interaction === interaction
                && mutator.type === workflow.type);

        if(supportedMutators.length === 1) {
            return supportedMutators[0];
        } else if(supportedMutators.length > 1) {
            return getRandomArrayEntry(supportedMutators);
        } else {
            throw this.#taskNotConfiguredError;
        }
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
            case BotFunction.Media:
                this.#helpService = new ImageHelpService(this);
                this.#generativeChatClient = new GenerativeMediaChatClient(this);
                break;
            case BotFunction.Chat:
                this.#helpService = new TextHelpService(this);
                this.#generativeChatClient = new GenerativeChatClient(this);
                break;
        }
    }
}
