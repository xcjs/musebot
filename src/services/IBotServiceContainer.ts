import {
  ButtonInteraction,
  Client as DiscordClient,
  Message as DiscordMessage,
  MessageReaction,
  User} from 'discord.js';

import { BotInteraction } from '../enums/BotInteraction.js';
import { IHttpExchange } from '../models/IHttpExchange.js';
import { IHttpExchangeWithAttachedData } from '../models/IHttpExchangeWithAttachedData.js';
import { ComfyUiReplyService } from './clients/chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IActionRowBuilderFactory } from './clients/chat/discord/components/IActionRowBuilderFactory.js';
import { LlmReplyService } from './clients/chat/discord/llm/LlmReplyService.js';
import { LlmStreamingReplyService } from './clients/chat/discord/llm/LlmStreamingReplyService.js';
import { IChatMessageFactory } from './clients/chat/IChatMessageFactory.js';
import { IGenerativeChatClient } from './clients/chat/IGenerativeChatClient.js';
import { IInputChatMessageFilter } from './clients/chat/IInputChatMessageFilter.js';
import { IOutputChatMessageFilter } from './clients/chat/IOutputChatMessageFilter.js';
import { IReplyService } from './clients/chat/IReplyService.js';
import { ITypingService } from './clients/chat/ITypingService.js';
import { ILlmClient } from './clients/llm/ILlmClient.js';
import { LlmHostFlavorRegistry } from './clients/llm/LlmHostFlavorRegistry.js';
import { ILlmRequest } from './clients/llm/models/ILlmRequest.js';
import { IStructuredRequestData } from './clients/llm/models/IStructuredRequestData.js';
import { LlmChatMessage } from './clients/llm/models/LlmChatMessage.js';
import { LlmGenerateResult } from './clients/llm/models/LlmGenerateResult.js';
import { IContextCompressionService } from './clients/llm/services/IContextCompressionService.js';
import { IContextMessageFactory } from './clients/llm/services/IContextMessageFactory.js';
import { IContextService } from './clients/llm/services/IContextService.js';
import { ILlmChatMessageFactory } from './clients/llm/services/ILlmChatMessageFactory.js';
import { IMemoryService } from './clients/llm/services/IMemoryService.js';
import { WebContentService } from './clients/llm/services/web/WebContentService.js';
import { ComfyUiClient } from './clients/media/comfy-ui/ComfyUiClient.js';
import { IWorkflow } from './clients/media/comfy-ui/models/IWorkflow.js';
import { IWorkflowService } from './clients/media/comfy-ui/services/IWorkflowService.js';
import { IWorkflowMutator } from './clients/media/comfy-ui/services/workflow-mutators/IWorkflowMutator.js';
import { IConfigurationService } from './environment-settings/IConfigurationService.js';
import { IContentTypeService } from './features/IContentTypeService.js';
import { IFeatureService } from './features/IFeatureService.js';
import { IHelpService } from './help/IHelpService.js';
import { ILogger } from './ILogger.js';
import { IParallelizationStrategy } from './parallelization/IParallelizationStrategy.js';
import { ITaskChannelPostProcessor } from './parallelization/ITaskChannelPostProcessor.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';
import { BaseTask } from './tasks/models/BaseTask.js';

/**
 * Bot-specific service container - one instance per bot
 */
export interface IBotServiceContainer {
  // Singletons -------------------------------------------------------------/
  configurationService: IConfigurationService;
  featureService: IFeatureService;
  taskQueue: ITaskQueue;
  typingService: ITypingService;
  discordClient: DiscordClient;
  generativeChatClient: IGenerativeChatClient;
  helpService: IHelpService;
  workflowService: IWorkflowService;
  parallelizationStrategy: IParallelizationStrategy;
  webContentService: WebContentService;
  llmHostFlavorRegistry: LlmHostFlavorRegistry;

  getWorkflowMutator(interactionType: BotInteraction, workflow: IWorkflow): IWorkflowMutator;

  // Transients -------------------------------------------------------------/
  contentTypeService: IContentTypeService;
  comfyUiClient: ComfyUiClient;
  comfyUiReplyService: ComfyUiReplyService;
  llmClient: ILlmClient;
  llmReplyService: LlmReplyService;
  llmStreamingReplyService: LlmStreamingReplyService;
  actionRowBuilderFactory: IActionRowBuilderFactory;

  // Factories --------------------------------------------------------------/
  getLogger(prefix: string): ILogger;

  getChatMessageFilters(): IOutputChatMessageFilter[];
  getInputChatMessageFilters<ChatMessageType>(): IInputChatMessageFilter<ChatMessageType>[];
  getChatMessageFactory<MessageType>(): IChatMessageFactory<MessageType>;

  getLlmChatMessageFactory<ChatMessageType>(): ILlmChatMessageFactory<ChatMessageType>;

  getMemoryService(): IMemoryService;

  getContextMessageFactory<ChatMessageType, LlmMessageType>(): IContextMessageFactory<ChatMessageType, LlmMessageType>;
  getContextService<ChatMessageType, LlmMessageType>(): IContextService<ChatMessageType, LlmMessageType>
  getContextCompressionService(): IContextCompressionService;
  getLlmGenerateTask(prompt: string, temperature: number | undefined): BaseTask<IHttpExchange<ILlmRequest, LlmGenerateResult>>;
  getLlmGenerateStructuredTask<T>(prompt: string, structuredRequestData: IStructuredRequestData | undefined)
    : BaseTask<IHttpExchangeWithAttachedData<ILlmRequest, LlmGenerateResult, T>>;
  getEmbedTask(llmChatMessage: LlmChatMessage, ownerUserId?: string): BaseTask<void>;
  getEmojiReactionTask(reaction: MessageReaction, user: User): BaseTask<unknown>;

  getMessageTask(message: DiscordMessage): BaseTask<unknown>;
  getInteractionTask(interaction: ButtonInteraction): BaseTask<unknown>;
  getAttachmentTask(message: DiscordMessage, prompt: string): BaseTask<unknown>;
  getCustomInteractionTask(interaction: ButtonInteraction, workflow: IWorkflow): BaseTask<unknown>;

  getTaskChannelPostProcessor(channelName: string): ITaskChannelPostProcessor;

  getReplyService<MessageType, ReactionType, AttachmentType, InteractionType>(): IReplyService<MessageType, ReactionType, AttachmentType, InteractionType>;
}