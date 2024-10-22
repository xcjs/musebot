import { ButtonInteraction, Client as DiscordClient, Message } from 'discord.js';

import { Automatic1111ReplyService } from './clients/chat/discord/automatic1111/Automatic1111ReplyService.js';
import { EasyDiffusionReplyService } from './clients/chat/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { OllamaReplyService } from './clients/chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from './clients/chat/discord/ollama/OllamaStreamingReplyService.js';
import { IReplyService } from './clients/chat/IReplyService.js';
import { ITypingService } from './clients/chat/ITypingService.js';
import { Automatic1111Client } from './clients/images/automatic1111/Automatic1111Client.js';
import { EasyDiffusionClient } from './clients/images/easy-diffusion/EasyDiffusionClient.js';
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
import { OllamaClient } from './clients/text/ollama/OllamaClient.js';
import { IPromptResponseTask } from './clients/text/tasks/IPromptResponseTask.js';
import { IFeatureService } from './features/IFeatureService.js';
import { IEnvironmentSettings } from './IEnvironmentSettings.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';

export interface IServiceContainer {
    // Singletons -------------------------------------------------------------/

    environmentSettings: IEnvironmentSettings;
    featureService: IFeatureService;
    taskQueue: ITaskQueue;
    typingService: ITypingService;
    discordClient: DiscordClient;

    // Transitives ------------------------------------------------------------/

    replyService: IReplyService;
    automatic1111Client: Automatic1111Client;
    automatic1111ReplyService: Automatic1111ReplyService;
    easyDiffusionClient: EasyDiffusionClient;
    easyDiffusionReplyService: EasyDiffusionReplyService;
    ollamaClient: OllamaClient;
    ollamaReplyService: OllamaReplyService;
    ollamaStreamingReplyService: OllamaStreamingReplyService;

    // Factories --------------------------------------------------------------/

    getAttachRenderTask(
        interaction: ButtonInteraction | Message,
        prompt: string,
        content: string | null,
        isEdit: boolean): IAttachRenderTask;

    getDecreaseGuidanceScaleRenderTask(interaction: ButtonInteraction): IDecreaseGuidanceScaleRenderTask;
    getExpandPromptTask(interaction: ButtonInteraction): IExpandPromptTask;
    getIncreaseGuidanceScaleRenderTask(interaction: ButtonInteraction): IIncreaseGuidanceScaleRenderTask;
    getJsonRenderTask(message: Message): IJsonRenderTask;
    getPromptRenderTask(message: Message): IPromptRenderTask;
    getRandomRenderTask(interaction: ButtonInteraction): IRandomRenderTask;
    getRetryRenderTask(interaction: ButtonInteraction): IRetryRenderTask;
    getShowSourceTask(interaction: ButtonInteraction): IShowSourceTask;
    getUpscaleRenderTask(interaction: ButtonInteraction): IUpscaleRenderTask;
    getPromptResponseTask(message: Message, context: Array<number>): IPromptResponseTask;
}
