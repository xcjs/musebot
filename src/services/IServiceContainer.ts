import { ApplicationEmoji, BaseMessageOptions, ButtonInteraction, Client as DiscordClient, GuildEmoji, Message, MessageReaction, ReactionEmoji, User } from 'discord.js';

import { ComfyUiReplyService } from './clients/chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IActionRowBuilderFactory } from './clients/chat/discord/components/IActionRowBuilderFactory.js';
import { OllamaReplyService } from './clients/chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from './clients/chat/discord/ollama/OllamaStreamingReplyService.js';
import { IGenerativeChatClient } from './clients/chat/IGenerativeChatClient.js';
import { IReplyService } from './clients/chat/IReplyService.js';
import { ITypingService } from './clients/chat/ITypingService.js';
import { IReplyTask } from './clients/chat/tasks/IReplyTask.js';
import { ComfyUiClient } from './clients/images/comfy-ui/ComfyUiClient.js';
import { IWorkflow } from './clients/images/comfy-ui/models/IWorkflow.js';
import { IWorkflowService } from './clients/images/comfy-ui/services/IWorkflowService.js';
import { ComfyUiImg2ImgRenderTask } from './clients/images/comfy-ui/tasks/ComfyUiImg2ImgRenderTask.js';
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
import { OllamaClient } from './clients/text/ollama/OllamaClient.js';
import { IEmojiResponseTask } from './clients/text/tasks/IEmojiResponseTask.js';
import { IPromptResponseTask } from './clients/text/tasks/IPromptResponseTask.js';
import { IEnvironmentSettings } from './environment-settings/IEnvironmentSettings.js';
import { IFeatureService } from './features/IFeatureService.js';
import { IHelpService } from './help/IHelpService.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';

export interface IServiceContainer {
    // Singletons -------------------------------------------------------------/

    environmentSettings: IEnvironmentSettings;
    featureService: IFeatureService;
    taskQueue: ITaskQueue;
    typingService: ITypingService;
    discordClient: DiscordClient;
    generativeChatClient: IGenerativeChatClient;
    workflowService: IWorkflowService;

    // Transitives ------------------------------------------------------------/

    replyService: IReplyService;
    comfyUiClient: ComfyUiClient;
    comfyUiReplyService: ComfyUiReplyService;
    ollamaClient: OllamaClient;
    ollamaReplyService: OllamaReplyService;
    ollamaStreamingReplyService: OllamaStreamingReplyService;
    actionRowBuilderFactory: IActionRowBuilderFactory;
    helpService: IHelpService;

    // Factories --------------------------------------------------------------/
    getReplyTask(
        interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions): IReplyTask;

    getAttachRenderTask(
        interaction: ButtonInteraction | Message,
        prompt: string,
        content: string | null): IAttachRenderTask;

    getDecreaseGuidanceScaleRenderTask(interaction: ButtonInteraction): IDecreaseGuidanceScaleRenderTask;
    getEmojiReactionRenderTask(interaction: Message, emoji: GuildEmoji | ReactionEmoji | ApplicationEmoji, userOverride: User): IEmojiReactionRenderTask;
    getExpandPromptTask(interaction: ButtonInteraction): IExpandPromptTask;
    getImg2ImgRenderTask(interaction: ButtonInteraction, workflow: IWorkflow): ComfyUiImg2ImgRenderTask;
    getIncreaseGuidanceScaleRenderTask(interaction: ButtonInteraction): IIncreaseGuidanceScaleRenderTask;
    getJsonRenderTask(message: Message): IJsonRenderTask;
    getRandomRenderTask(interaction: ButtonInteraction): IRandomRenderTask;
    getReplyRenderTask(message: Message): IReplyRenderTask;
    getRetryRenderTask(interaction: ButtonInteraction): IRetryRenderTask;
    getShowSourceTask(interaction: ButtonInteraction): IShowSourceTask;
    getPromptResponseTask(message: Message, context: Array<number>): IPromptResponseTask;
    getEmojiResponseTask(reaction: MessageReaction, user: User, context: Array<number>): IEmojiResponseTask;
}
