import {
    ButtonInteraction,
    Client as DiscordClient,
    GatewayIntentBits,
    Message as DiscordMessage,
    MessageReaction,
    Partials,
    User} from 'discord.js';
import { GenerateRequest, GenerateResponse, Message as OllamaMessage } from 'ollama';

import { BotFunction } from '../enums/BotFunction.js';
import { BotInteraction } from '../enums/BotInteraction.js';
import { IHttpExchange } from '../models/IHttpExchange.js';
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
import { IGenerativeChatClient } from './clients/chat/IGenerativeChatClient.js';
import { IReplyService } from './clients/chat/IReplyService.js';
import { ITypingService } from './clients/chat/ITypingService.js';
import { ShowHelpTask } from './clients/internal/tasks/ShowHelpTask.js';
import { TextHelpService } from './clients/llm/help/TextHelpService.js';
import { OllamaClient } from './clients/llm/ollama/OllamaClient.js';
import { OllamaEmojiResponseTask } from './clients/llm/ollama/tasks/OllamaEmojiResponseTask.js';
import { OllamaGenerateTask } from './clients/llm/ollama/tasks/OllamaGenerateTask.js';
import { OllamaPromptResponseTask } from './clients/llm/ollama/tasks/OllamaPromptResponseTask.js';
import { IEmojiResponseTask } from './clients/llm/tasks/IEmojiResponseTask.js';
import { IPromptResponseTask } from './clients/llm/tasks/IPromptResponseTask.js';
import { ComfyUiClient } from './clients/media/comfy-ui/ComfyUiClient.js';
import { IWorkflow } from './clients/media/comfy-ui/models/IWorkflow.js';
import { IWorkflowService } from './clients/media/comfy-ui/services/IWorkflowService.js';
import { ExpandPromptMutator } from './clients/media/comfy-ui/services/workflow-mutators/ExpandPromptMutator.js';
import { GuidanceScaleMutator } from './clients/media/comfy-ui/services/workflow-mutators/GuidanceScaleMutator.js';
import { IWorkflowMutator } from './clients/media/comfy-ui/services/workflow-mutators/IWorkflowMutator.js';
import { JsonMutator } from './clients/media/comfy-ui/services/workflow-mutators/JsonMutator.js';
import { MessageToMediaMutator } from './clients/media/comfy-ui/services/workflow-mutators/MessageToMediaMutator.js';
import { MessageToMusicMutator } from './clients/media/comfy-ui/services/workflow-mutators/MessageToMusicMutator.js';
import { RandomPromptMutator } from './clients/media/comfy-ui/services/workflow-mutators/RandomPromptMutator.js';
import { RetryMutator } from './clients/media/comfy-ui/services/workflow-mutators/RetryMutator.js';
import { WorkflowService } from './clients/media/comfy-ui/services/WorkflowService.js';
import { ComfyUiAttachRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiAttachRenderTask.js';
import { ComfyUiImg2ImgRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiImg2ImgRenderTask.js';
import { ComfyUiInteractionTask } from './clients/media/comfy-ui/tasks/ComfyUiInteractionTask.js';
import { ComfyUiMessageTask } from './clients/media/comfy-ui/tasks/ComfyUiMessageTask.js';
import { ComfyUiReactionTask } from './clients/media/comfy-ui/tasks/ComfyUiReactionTask.js';
import { ShowDescriptionTask } from './clients/media/comfy-ui/tasks/ShowDescriptionTask.js';
import { ImageHelpService } from './clients/media/help/ImageHelpService.js';
import { IAttachRenderTask } from './clients/media/tasks/IAttachRenderTask.js';
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
import { BaseTask } from './tasks/models/BaseTask.js';
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
        return new ContentTypeService();
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

    getImg2ImgRenderTask(interaction: ButtonInteraction, workflow: IWorkflow) {
        if(!this.#featureService.hasFeature(SupportedFeature.Img2Img)
            && !this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            throw this.#taskNotConfiguredError;
        }

        return new ComfyUiImg2ImgRenderTask(this, interaction, workflow);
    }

    getLlmGenerateTask(prompt: string): BaseTask<IHttpExchange<GenerateRequest, GenerateResponse>> {
        if(!this.featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            throw this.#taskNotConfiguredError;
        }

        return new OllamaGenerateTask(this, prompt);
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

    getMessageTask(message: DiscordMessage): BaseTask<unknown> {
        switch(this.#environmentSettings.botFunction) {
            case BotFunction.Chat:

                break;
            case BotFunction.Media:
                    return new ComfyUiMessageTask(this, message);
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getInteractionTask(interaction: ButtonInteraction): BaseTask<unknown> {
        switch(this.#environmentSettings.botFunction) {
            case BotFunction.Chat:
                switch (interaction.customId as BotInteraction) {
                    case BotInteraction.Help:
                        return new ShowHelpTask(this, interaction);
                    default:
                        throw this.#taskNotConfiguredError;
                }
            case BotFunction.Media:
                switch(interaction.customId as BotInteraction) {
                    case BotInteraction.Retry:
                    case BotInteraction.GuidanceScaleMinus:
                    case BotInteraction.GuidanceScalePlus:
                    case BotInteraction.ExpandPrompt:
                    case BotInteraction.Randomize:
                        return new ComfyUiInteractionTask(this, interaction);
                    case BotInteraction.ShowSource:
                        return new ShowDescriptionTask(this, interaction);
                    case BotInteraction.Help:
                        return new ShowHelpTask(this, interaction);
                    default:
                        throw this.#taskNotConfiguredError;
                }
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getMessageReactionTask(reaction: MessageReaction, user: User, context: OllamaMessage[] = []): BaseTask<unknown> {
        switch(this.environmentSettings.botFunction) {
            case BotFunction.Chat:
                return new OllamaEmojiResponseTask(this, reaction, user, context);
            case BotFunction.Media:
                return new ComfyUiReactionTask(this, reaction)
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getWorkflowMutator(interactionType: BotInteraction, workflow: IWorkflow): IWorkflowMutator {
        const mutators: IWorkflowMutator[] = [
            new GuidanceScaleMutator(this),
            new JsonMutator(this),
            new MessageToMediaMutator(this),
            new MessageToMusicMutator(this),
            new ExpandPromptMutator(this),
            new RandomPromptMutator(this),
            new RetryMutator(this)
        ];

        const supportedMutators = mutators.filter(
            mutator => mutator.interactions.includes(interactionType)
                && mutator.types.includes(workflow.type));

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
