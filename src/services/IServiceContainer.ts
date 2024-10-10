import { Client as DiscordClient } from 'discord.js';

import { TypingService } from './clients/discord/services/TypingService.js';
import { FeatureService } from './features/FeatureService.js';
import { TaskQueue } from './tasks/services/TaskQueue.js';
import { MessageService } from './clients/discord/services/MessageService.js';
import { Automatic1111Client } from './clients/automatic1111/Automatic1111Client.js';
import { DiscordAutomatic1111Client } from './clients/discord/automatic1111/DiscordAutomatic1111Client.js';
import { EasyDiffusionClient } from './clients/easy-diffusion/EasyDiffusionClient';
import { DiscordEasyDiffusionClient } from './clients/discord/easy-diffusion/DiscordEasyDiffusionClient.js';
import { OllamaClient } from './clients/ollama/OllamaClient.js';
import { DiscordOllamaClient } from './clients/discord/ollama/DiscordOllamaClient.js';
import { ReplyService } from './clients/discord/services/ReplyService.js';
import { Automatic1111ReplyService } from './clients/discord/automatic1111/Automatic1111ReplyService.js';
import { EasyDiffusionReplyService } from './clients/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { OllamaReplyService } from './clients/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from './clients/discord/ollama/OllamaStreamingReplyService.js';
import { IEnvironmentSettings } from './IEnvironmentSettings.js';

export interface IServiceContainer {
    // Singletons -------------------------------------------------------------/

    environmentSettings: IEnvironmentSettings;
    featureService: FeatureService;
    taskQueue: TaskQueue;
    typingService: TypingService;
    discordClient: DiscordClient;

    // Transitives ------------------------------------------------------------/

    messageService: MessageService;
    replyService: ReplyService;
    automatic1111Client: Automatic1111Client;
    automatic1111ReplyService: Automatic1111ReplyService;
    discordAutomatic1111Client: DiscordAutomatic1111Client;
    easyDiffusionClient: EasyDiffusionClient;
    easyDiffusionReplyService: EasyDiffusionReplyService;
    discordEasyDiffusionClient: DiscordEasyDiffusionClient;
    ollamaClient: OllamaClient;
    ollamaReplyService: OllamaReplyService;
    ollamaStreamingReplyService: OllamaStreamingReplyService;
    discordOllamaClient: DiscordOllamaClient;
}
