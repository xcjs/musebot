import { Client as DiscordClient } from 'discord.js';

import { TypingService } from 'services/clients/chat/discord/TypingService.js';
import { FeatureService } from 'services/features/FeatureService.js';
import { TaskQueue } from 'services/tasks/TaskQueue.js';
import { MessageService } from 'services/clients/chat/discord/MessageService.js';
import { Automatic1111Client } from 'services/clients/images/automatic1111/Automatic1111Client.js';
import { DiscordAutomatic1111Client } from 'services/clients/chat/discord/automatic1111/DiscordAutomatic1111Client.js';
import { EasyDiffusionClient } from 'services/clients/images/easy-diffusion/EasyDiffusionClient';
import { DiscordEasyDiffusionClient } from 'services/clients/chat/discord/easy-diffusion/DiscordEasyDiffusionClient.js';
import { OllamaClient } from 'services/clients/text/ollama/OllamaClient.js';
import { DiscordOllamaClient } from 'services/clients/chat/discord/ollama/DiscordOllamaClient.js';
import { ReplyService } from 'services/clients/chat/discord/ReplyService.js';
import { Automatic1111ReplyService } from 'services/clients/chat/discord/automatic1111/Automatic1111ReplyService.js';
import { EasyDiffusionReplyService } from 'services/clients/chat/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { OllamaReplyService } from 'services/clients/chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from 'services/clients/chat/discord/ollama/OllamaStreamingReplyService.js';
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
