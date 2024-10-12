import { Client as DiscordClient } from 'discord.js';

import { IEnvironmentSettings } from './IEnvironmentSettings.js';
import { Automatic1111ReplyService } from './clients/chat/discord/automatic1111/Automatic1111ReplyService.js';
import { EasyDiffusionReplyService } from './clients/chat/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { MessageService } from './clients/chat/discord/MessageService.js';
import { OllamaReplyService } from './clients/chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from './clients/chat/discord/ollama/OllamaStreamingReplyService.js';
import { ReplyService } from './clients/chat/discord/ReplyService.js';
import { Automatic1111Client } from './clients/images/automatic1111/Automatic1111Client.js';
import { EasyDiffusionClient } from './clients/images/easy-diffusion/EasyDiffusionClient.js';
import { OllamaClient } from './clients/text/ollama/OllamaClient.js';
import { IFeatureService } from './features/IFeatureService.js';
import { ITaskQueue } from './tasks/ITaskQueue.js';
import { ITypingService } from './clients/chat/ITypingService.js';

export interface IServiceContainer {
    // Singletons -------------------------------------------------------------/

    environmentSettings: IEnvironmentSettings;
    featureService: IFeatureService;
    taskQueue: ITaskQueue;
    typingService: ITypingService;
    discordClient: DiscordClient;

    // Transitives ------------------------------------------------------------/

    messageService: MessageService;
    replyService: ReplyService;
    automatic1111Client: Automatic1111Client;
    automatic1111ReplyService: Automatic1111ReplyService;
    easyDiffusionClient: EasyDiffusionClient;
    easyDiffusionReplyService: EasyDiffusionReplyService;
    ollamaClient: OllamaClient;
    ollamaReplyService: OllamaReplyService;
    ollamaStreamingReplyService: OllamaStreamingReplyService;
}
