import {
    ButtonInteraction,
    Client as DiscordClient,
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
import { OllamaClient } from './clients/llm/ollama/OllamaClient.js';
import { IEmojiResponseTask } from './clients/llm/tasks/IEmojiResponseTask.js';
import { IPromptResponseTask } from './clients/llm/tasks/IPromptResponseTask.js';
import { ComfyUiClient } from './clients/media/comfy-ui/ComfyUiClient.js';
import { IWorkflow } from './clients/media/comfy-ui/models/IWorkflow.js';
import { IWorkflowService } from './clients/media/comfy-ui/services/IWorkflowService.js';
import { IWorkflowMutator } from './clients/media/comfy-ui/services/workflow-mutators/IWorkflowMutator.js';
import { ComfyUiImg2ImgRenderTask } from './clients/media/comfy-ui/tasks/ComfyUiImg2ImgRenderTask.js';
import { IAttachRenderTask } from './clients/media/tasks/IAttachRenderTask.js';
import { IEmojiReactionRenderTask } from './clients/media/tasks/IEmojiReactionRenderTask.js';
import { IEnvironmentSettings } from './environment-settings/IEnvironmentSettings.js';
import { IContentTypeService } from './features/IContentTypeService.js';
import { IFeatureService } from './features/IFeatureService.js';
import { IHelpService } from './help/IHelpService.js';
import { ILogger } from './ILogger.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';
import { BaseTask } from './tasks/models/BaseTask.js';

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

    getAttachRenderTask(
        interaction: ButtonInteraction | DiscordMessage,
        prompt: string,
        content: string | null): IAttachRenderTask;

    getImg2ImgRenderTask(interaction: ButtonInteraction, workflow: IWorkflow): ComfyUiImg2ImgRenderTask;
    getEmojiReactionRenderTask(interaction: DiscordMessage, emoji: ReactionEmoji, userOverride: User): IEmojiReactionRenderTask;
    getLlmPromptResponseTask(message: DiscordMessage, context: OllamaMessage[]): IPromptResponseTask;
    getLlmEmojiResponseTask(reaction: MessageReaction, user: User, context: OllamaMessage[]): IEmojiResponseTask;

    getMessageTask(message: DiscordMessage): BaseTask<unknown>;
    getInteractionTask(interaction: ButtonInteraction): BaseTask<unknown>

    getWorkflowMutator(interactionType: BotInteraction, workflow: IWorkflow): IWorkflowMutator;
}
