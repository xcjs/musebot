import { Client as DiscordClient } from 'discord.js';

import { IEnvironmentSettings } from './IEnvironmentSettings';
import { Automatic1111ReplyService } from './clients/chat/discord/automatic1111/Automatic1111ReplyService';
import { DiscordAutomatic1111Client } from './clients/chat/discord/automatic1111/DiscordAutomatic1111Client';
import { DiscordEasyDiffusionClient } from './clients/chat/discord/easy-diffusion/DiscordEasyDiffusionClient';
import { EasyDiffusionReplyService } from './clients/chat/discord/easy-diffusion/EasyDiffusionReplyService';
import { MessageService } from './clients/chat/discord/MessageService';
import { DiscordOllamaClient } from './clients/chat/discord/ollama/DiscordOllamaClient';
import { OllamaReplyService } from './clients/chat/discord/ollama/OllamaReplyService';
import { OllamaStreamingReplyService } from './clients/chat/discord/ollama/OllamaStreamingReplyService';
import { ReplyService } from './clients/chat/discord/ReplyService';
import { TypingService } from './clients/chat/discord/TypingService';
import { Automatic1111Client } from './clients/images/automatic1111/Automatic1111Client';
import { EasyDiffusionClient } from './clients/images/easy-diffusion/EasyDiffusionClient';
import { OllamaClient } from './clients/text/ollama/OllamaClient';
import { IFeatureService } from './features/IFeatureService';
import { TaskQueue } from './tasks/TaskQueue';

export interface IServiceContainer {
    // Singletons -------------------------------------------------------------/

    environmentSettings: IEnvironmentSettings;
    featureService: IFeatureService;
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
