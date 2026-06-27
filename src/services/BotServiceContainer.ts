import {
    ButtonInteraction,
    Client as DiscordClient,
    GatewayIntentBits,
    Message as DiscordMessage,
    MessageReaction,
    Partials,
    User
} from 'discord.js';
import { GenerateRequest, GenerateResponse } from 'ollama';

import { BotInteraction } from '../enums/BotInteraction.js';
import { BotMode } from '../enums/BotMode.js';
import { IHttpExchange } from '../models/IHttpExchange.js';
import { IHttpExchangeWithAttachedData } from '../models/IHttpExchangeWithAttachedData.js';
import { getRandomArrayEntry } from '../utilities/random-utilities.js';
import { ComfyUiReplyService } from './clients/chat/discord/comfy-ui/ComfyUiReplyService.js';
import { ActionRowBuilderFactory } from './clients/chat/discord/components/ActionRowBuilderFactory.js';
import { IActionRowBuilderFactory } from './clients/chat/discord/components/IActionRowBuilderFactory.js';
import { DiscordConstants } from './clients/chat/discord/enums/DiscordConstants.js';
import { DiscordAttachmentFilter } from './clients/chat/discord/filters/DiscordAttachmentFilter.js';
import { DiscordCodeBlockExtractFilter } from './clients/chat/discord/filters/DiscordCodeBlockExtractFilter.js';
import { DiscordCodeBlockSplitFilter } from './clients/chat/discord/filters/DiscordCodeBlockSplitFilter.js';
import { DiscordMarkdownTableFilter } from './clients/chat/discord/filters/DiscordMarkdownTableFilter.js';
import { DiscordMessageSplitFilter } from './clients/chat/discord/filters/DiscordMessageSplitFilter.js';
import { GenerativeChatClient } from './clients/chat/discord/GenerativeChatClient.js';
import { GenerativeMediaChatClient } from './clients/chat/discord/GenerativeMediaChatClient.js';
import { DiscordChatMessageFactory } from './clients/chat/discord/ollama/DiscordChatMessageFactory.js';
import { DiscordOllamaContextMessageFactory } from './clients/chat/discord/ollama/DiscordOllamaContextMessageFactory.js';
import { OllamaReplyService } from './clients/chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from './clients/chat/discord/ollama/OllamaStreamingReplyService.js';
import { DiscordReplyService } from './clients/chat/discord/services/DiscordReplyService.js';
import { DiscordTypingService } from './clients/chat/discord/services/DiscordTypingService.js';
import { IChatMessageFactory } from './clients/chat/IChatMessageFactory.js';
import { IChatMessageFilter } from './clients/chat/IChatMessageFilter.js';
import { IGenerativeChatClient } from './clients/chat/IGenerativeChatClient.js';
import { IReplyService } from './clients/chat/IReplyService.js';
import { ITypingService } from './clients/chat/ITypingService.js';
import { ShowHelpTask } from './clients/internal/tasks/ShowHelpTask.js';
import { ChatHelpService } from './clients/llm/help/ChatHelpService.js';
import { IStructuredRequestData } from './clients/llm/ollama/models/IStructuredRequestData.js';
import { OllamaClient } from './clients/llm/ollama/OllamaClient.js';
import { OllamaEmojiReactionTask } from './clients/llm/ollama/tasks/OllamaEmojiReactionTask.js';
import { OllamaGenerateStructuredTask } from './clients/llm/ollama/tasks/OllamaGenerateStructuredTask.js';
import { OllamaGenerateTask } from './clients/llm/ollama/tasks/OllamaGenerateTask.js';
import { OllamaMessageTask } from './clients/llm/ollama/tasks/OllamaMessageTask.js';
import { ContextService } from './clients/llm/services/ContextService.js';
import { IContextMessageFactory } from './clients/llm/services/IContextMessageFactory.js';
import { IContextService } from './clients/llm/services/IContextService.js';
import { ComfyUiClient } from './clients/media/comfy-ui/ComfyUiClient.js';
import { IWorkflow } from './clients/media/comfy-ui/models/IWorkflow.js';
import { IWorkflowService } from './clients/media/comfy-ui/services/IWorkflowService.js';
import { ContextualMediaMutator } from './clients/media/comfy-ui/services/workflow-mutators/ContextualMediaMutator.js';
import { ExpandPromptMutator } from './clients/media/comfy-ui/services/workflow-mutators/ExpandPromptMutator.js';
import { GuidanceScaleMutator } from './clients/media/comfy-ui/services/workflow-mutators/GuidanceScaleMutator.js';
import { IWorkflowMutator } from './clients/media/comfy-ui/services/workflow-mutators/IWorkflowMutator.js';
import { JsonMutator } from './clients/media/comfy-ui/services/workflow-mutators/JsonMutator.js';
import { MessageToMediaMutator } from './clients/media/comfy-ui/services/workflow-mutators/MessageToMediaMutator.js';
import { MessageToMusicMutator } from './clients/media/comfy-ui/services/workflow-mutators/MessageToMusicMutator.js';
import { RandomPromptMutator } from './clients/media/comfy-ui/services/workflow-mutators/RandomPromptMutator.js';
import { RetryMutator } from './clients/media/comfy-ui/services/workflow-mutators/RetryMutator.js';
import { WorkflowService } from './clients/media/comfy-ui/services/WorkflowService.js';
import { ComfyUiAttachmentTask } from './clients/media/comfy-ui/tasks/ComfyUiAttachmentTask.js';
import { ComfyUiImg2ImgInteractionTask } from './clients/media/comfy-ui/tasks/ComfyUiImg2ImgInteractionTask.js';
import { ComfyUiInteractionTask } from './clients/media/comfy-ui/tasks/ComfyUiInteractionTask.js';
import { ComfyUiMessageTask } from './clients/media/comfy-ui/tasks/ComfyUiMessageTask.js';
import { ShowDescriptionTask } from './clients/media/comfy-ui/tasks/ShowDescriptionTask.js';
import { MediaHelpService } from './clients/media/help/MediaHelpService.js';
import { ConfigurationService } from './environment-settings/ConfigurationService.js';
import { IBotConfig } from './environment-settings/IBotConfig.js';
import { IConfigurationService } from './environment-settings/IConfigurationService.js';
import { ContentTypeService } from './features/ContentTypeService.js';
import { SupportedFeature } from './features/enum/SupportedFeature.js';
import { FeatureService } from './features/FeatureService.js';
import { IContentTypeService } from './features/IContentTypeService.js';
import { IFeatureService } from './features/IFeatureService.js';
import { GlobalServiceContainer } from './GlobalServiceContainer.js';
import { IHelpService } from './help/IHelpService.js';
import { IBotServiceContainer } from './IBotServiceContainer.js';
import { IGlobalServiceContainer } from './IGlobalServiceContainer.js';
import { ILogger } from './ILogger.js';
import { Logger } from './Logger.js';
import { IParallelizationStrategy } from './parallelization/IParallelizationStrategy.js';
import { ITaskChannelPostProcessor } from './parallelization/ITaskChannelPostProcessor.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';
import { BaseTask } from './tasks/models/BaseTask.js';

export class BotServiceContainer implements IBotServiceContainer {
    readonly #taskNotConfiguredError = new Error('The task you are attempting to instantiate is not supported by your current configuration.');

    readonly #globalServiceContainer: GlobalServiceContainer;

    get globalContainer(): IGlobalServiceContainer  {
        return this.#globalServiceContainer;
    }

    readonly #configurationService: IConfigurationService;
    get configurationService(): IConfigurationService {
        return this.#configurationService;
    }

    get taskQueue(): ITaskQueue {
        return this.#globalServiceContainer.taskQueue;
    }

    get parallelizationStrategy(): IParallelizationStrategy {
        return this.#globalServiceContainer.parallelizationStrategy;
    }

    // Singletons -------------------------------------------------------------/

    readonly #featureService: IFeatureService;
    get featureService(): IFeatureService {
        return this.#featureService;
    }

    readonly #typingService: ITypingService;
    get typingService(): ITypingService {
        return this.#typingService;
    }

    readonly #discordClient: DiscordClient;
    get discordClient(): DiscordClient {
        return this.#discordClient;
    }

    readonly #generativeChatClient: IGenerativeChatClient;
    get generativeChatClient(): IGenerativeChatClient {
        return this.#generativeChatClient;
    }

    readonly #helpService: IHelpService;
    get helpService(): IHelpService {
        return this.#helpService;
    }

    readonly #workflowService: IWorkflowService;
    get workflowService(): IWorkflowService {
        return this.#workflowService;
    }

    // Transients -------------------------------------------------------------/

    get contentTypeService(): IContentTypeService {
        return new ContentTypeService();
    }

    getReplyService<MessageType, ReactionType, AttachmentType, InteractionType>(): IReplyService<MessageType, ReactionType, AttachmentType, InteractionType> {
        return new DiscordReplyService(this) as unknown as IReplyService<MessageType, ReactionType, AttachmentType, InteractionType>;
    }

    getWorkflowMutator(interactionType: BotInteraction, workflow: IWorkflow): IWorkflowMutator {
        const mutators: IWorkflowMutator[] = [
            new ContextualMediaMutator(this),
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
            const mutator = getRandomArrayEntry(supportedMutators);

            if(mutator === null) {
                throw new Error('A supported mutator could not be found.');
            }

            return mutator;
        } else {
            throw new Error('The task you are attempting to instantiate is not supported by your current configuration.');
        }
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
        return new Logger(prefix, this.#configurationService.botId);
    }

    getChatMessageFilters(): IChatMessageFilter[] {
        return [
            new DiscordCodeBlockExtractFilter(this),
            new DiscordMarkdownTableFilter(),
            new DiscordMessageSplitFilter(),
            new DiscordCodeBlockSplitFilter(),
            new DiscordAttachmentFilter()
        ];
    }

    getChatMessageFactory<MessageType>(): IChatMessageFactory<MessageType> {
        return new DiscordChatMessageFactory(this) as unknown as IChatMessageFactory<MessageType>;
    }

    #contextMessageFactory: IContextMessageFactory<unknown, unknown> | null = null;
    getContextMessageFactory<ChatMessageType, LlmMessageType>(): IContextMessageFactory<ChatMessageType, LlmMessageType> {
        if(this.#contextMessageFactory === null) {
            this.#contextMessageFactory = new DiscordOllamaContextMessageFactory(this);
        }

        return this.#contextMessageFactory as IContextMessageFactory<ChatMessageType, LlmMessageType>;
    }

    #contextService: IContextService<unknown, unknown> | null = null;
    getContextService<ChatMessageType, LlmMessageType>(): IContextService<ChatMessageType, LlmMessageType> {
        if(this.#contextService === null) {
            this.#contextService = new ContextService<ChatMessageType, LlmMessageType>(this);
        }

        return this.#contextService as IContextService<ChatMessageType, LlmMessageType>;
    }

    getLlmGenerateTask(prompt: string, temperature: number | undefined): BaseTask<IHttpExchange<GenerateRequest, GenerateResponse>> {
        if(!this.featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            throw this.#taskNotConfiguredError;
        }

        return new OllamaGenerateTask(this, prompt, temperature) as BaseTask<IHttpExchange<GenerateRequest, GenerateResponse>>;
    }

    getLlmGenerateStructuredTask<T>(prompt: string, structuredRequestData: IStructuredRequestData): BaseTask<IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, T>> {
        if (!this.featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            throw this.#taskNotConfiguredError;
        }

        return new OllamaGenerateStructuredTask<T>(this, prompt, structuredRequestData) as BaseTask<IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, T>>;
    }

    getEmojiReactionTask(reaction: MessageReaction, user: User): BaseTask<unknown> {
        switch (this.configurationService.botFunction) {
            case BotMode.Chat:
                return new OllamaEmojiReactionTask(this, reaction, user) as BaseTask<unknown>;
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getMessageTask(message: DiscordMessage): BaseTask<unknown> {
        switch(this.configurationService.botFunction) {
            case BotMode.Chat:
                return new OllamaMessageTask(this, message) as BaseTask<unknown>;
            case BotMode.Media:
                return new ComfyUiMessageTask(this, message) as BaseTask<unknown>;
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getInteractionTask(interaction: ButtonInteraction): BaseTask<unknown> {
        switch(this.configurationService.botFunction) {
            case BotMode.Chat:
                switch (interaction.customId as BotInteraction) {
                    case BotInteraction.Help:
                        return new ShowHelpTask(this, interaction) as BaseTask<unknown>;
                    default:
                        throw this.#taskNotConfiguredError;
                }
            case BotMode.Media:
                switch(interaction.customId as BotInteraction) {
                    case BotInteraction.Retry:
                    case BotInteraction.GuidanceScaleMinus:
                    case BotInteraction.GuidanceScalePlus:
                    case BotInteraction.ExpandPrompt:
                    case BotInteraction.Randomize:
                        return new ComfyUiInteractionTask(this, interaction) as BaseTask<unknown>;
                    case BotInteraction.ShowSource:
                        return new ShowDescriptionTask(this, interaction) as BaseTask<unknown>;
                    case BotInteraction.Help:
                        return new ShowHelpTask(this, interaction) as BaseTask<unknown>;
                    default:
                        throw this.#taskNotConfiguredError;
                }
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getAttachmentTask(
        message: DiscordMessage,
        prompt: string): BaseTask<unknown> {
        return new ComfyUiAttachmentTask(this, message, prompt) as BaseTask<unknown>;
    }

    getCustomInteractionTask(interaction: ButtonInteraction, workflow: IWorkflow): BaseTask<unknown> {
        switch (workflow.type) {
            case SupportedFeature.Img2Img:
                return new ComfyUiImg2ImgInteractionTask(this, interaction, workflow) as BaseTask<unknown>;
            default:
                throw this.#taskNotConfiguredError;
        }
    }

    getTaskChannelPostProcessor(channelName: string): ITaskChannelPostProcessor {
        return this.#globalServiceContainer.getTaskChannelPostProcessor(this, channelName);
    }

    constructor(globalContainer: GlobalServiceContainer, botConfig: IBotConfig) {
        this.#globalServiceContainer = globalContainer;
        this.#configurationService = new ConfigurationService(botConfig);
        this.#workflowService = new WorkflowService(this.getLogger('WorkflowService'), botConfig.botId);
        this.#featureService = new FeatureService(this);
        this.#typingService = new DiscordTypingService(this);

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

        switch (this.configurationService.botFunction) {
            case BotMode.Chat:
                this.#helpService = new ChatHelpService(this);
                this.#generativeChatClient = new GenerativeChatClient(this);
                break;
            case BotMode.Media:
                this.#helpService = new MediaHelpService(this);
                this.#generativeChatClient = new GenerativeMediaChatClient(this);
                break;
            default:
                throw new Error('An invalid BotMode was selected.');
        }
    }
}
