import {
    ApplicationEmoji,
    BaseMessageOptions,
    ButtonInteraction,
    Client as DiscordClient,
    GuildEmoji,
    Message as DiscordMessage,
    MessageReaction,
    ReactionEmoji,
    User} from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { BotInteraction } from '../enums/BotInteraction.js';
import { ComfyUiReplyService } from './clients/chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IActionRowBuilderFactory } from './clients/chat/discord/components/IActionRowBuilderFactory.js';
import { OllamaReplyService } from './clients/chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from './clients/chat/discord/ollama/OllamaStreamingReplyService.js';
import { IGenerativeChatClient } from './clients/chat/IGenerativeChatClient.js';
import { IReplyService } from './clients/chat/IReplyService.js';
import { ITypingService } from './clients/chat/ITypingService.js';
import { IMentionTask } from './clients/chat/tasks/IMentionTask.js';
import { IReplyTask } from './clients/chat/tasks/IReplyTask.js';
import { OllamaClient } from './clients/llm/ollama/OllamaClient.js';
import { IEmojiResponseTask } from './clients/llm/tasks/IEmojiResponseTask.js';
import { IPromptResponseTask } from './clients/llm/tasks/IPromptResponseTask.js';
import { ComfyUiClient } from './clients/media/comfy-ui/ComfyUiClient.js';
import { IWorkflow } from './clients/media/comfy-ui/models/IWorkflow.js';
import { IWorkflowService } from './clients/media/comfy-ui/services/IWorkflowService.js';
import { IWorkflowMutator } from './clients/media/comfy-ui/services/workflow-mutators/IWorkflowMutator.js';
import { ComfyUiImg2ImgRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiImg2ImgRenderTask.js';
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
import { IEnvironmentSettings } from './environment-settings/IEnvironmentSettings.js';
import { IContentTypeService } from './features/IContentTypeService.js';
import { IFeatureService } from './features/IFeatureService.js';
import { IHelpService } from './help/IHelpService.js';
import { ILogger } from './ILogger.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';

export interface IServiceContainer {
    // Singletons -------------------------------------------------------------/

    environmentSettings: IEnvironmentSettings;
    featureService: IFeatureService;
    taskQueue: ITaskQueue;
    typingService: ITypingService;
    discordClient: DiscordClient;
    generativeChatClient: IGenerativeChatClient;
    helpService: IHelpService;
    workflowService: IWorkflowService;

    // Transients -------------------------------------------------------------/

    contentTypeService: IContentTypeService;
    replyService: IReplyService;
    comfyUiClient: ComfyUiClient;
    comfyUiReplyService: ComfyUiReplyService;
    ollamaClient: OllamaClient;
    ollamaReplyService: OllamaReplyService;
    ollamaStreamingReplyService: OllamaStreamingReplyService;
    actionRowBuilderFactory: IActionRowBuilderFactory;

    // Factories --------------------------------------------------------------/
    getLogger(prefix: string): ILogger;

    getReplyTask(
        interaction: DiscordMessage | ButtonInteraction,
        reply: BaseMessageOptions): IReplyTask;

    getMessageReplyTask(message: DiscordMessage): IMessageReplyTask;

    getAttachRenderTask(
        interaction: ButtonInteraction | DiscordMessage,
        prompt: string,
        content: string | null): IAttachRenderTask;

    getDecreaseGuidanceScaleRenderTask(interaction: ButtonInteraction): IDecreaseGuidanceScaleRenderTask;
    getEmojiReactionRenderTask(interaction: DiscordMessage, emoji: GuildEmoji | ReactionEmoji | ApplicationEmoji, userOverride: User): IEmojiReactionRenderTask;
    getExpandPromptTask(interaction: ButtonInteraction): IExpandPromptTask;
    getImg2ImgRenderTask(interaction: ButtonInteraction, workflow: IWorkflow): ComfyUiImg2ImgRenderTask;
    getIncreaseGuidanceScaleRenderTask(interaction: ButtonInteraction): IIncreaseGuidanceScaleRenderTask;
    getJsonRenderTask(message: DiscordMessage): IJsonRenderTask;
    getRandomRenderTask(interaction: ButtonInteraction): IRandomRenderTask;
    getReplyRenderTask(message: DiscordMessage): IReplyRenderTask;
    getRetryRenderTask(interaction: ButtonInteraction): IRetryRenderTask;
    getShowSourceTask(interaction: ButtonInteraction): IShowSourceTask;
    getLlmPromptResponseTask(message: DiscordMessage, context: OllamaMessage[]): IPromptResponseTask;
    getLlmEmojiResponseTask(reaction: MessageReaction, user: User, context: OllamaMessage[]): IEmojiResponseTask;

    getMentionTask(message: DiscordMessage): IMentionTask;

    getWorkflowMutator(botInteraction: BotInteraction, workflow: IWorkflow): IWorkflowMutator;
}
