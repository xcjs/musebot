import { Events, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseDiscordClient } from '../BaseDiscordClient.js';
import { DiscordPresenceStatus } from '../enums/DiscordPresenceStatus.js';
import { OllamaClient } from '../../ollama/OllamaClient.js';
import { TaskQueue } from '../../../tasks/services/TaskQueue.js';
import { PromptResponseTask } from '../../ollama/tasks/PromptResponseTask.js';
import { OllamaReplyService } from '../../ollama/services/OllamaReplyService.js';
import { EasyDiffusionReplyService } from '../easy-diffusion/EasyDiffusionReplyService.js';
import { EasyDiffusionClient } from '../../easy-diffusion/EasyDiffusionClient.js';
import { FeatureService } from '../../../features/FeatureService.js';
import { OllamaStreamingReplyService } from '../../ollama/services/OllamaStreamingReplyService.js';
import { ReplyService } from '../services/ReplyService.js';

export class DiscordOllamaClient extends BaseDiscordClient {
    #featureService: FeatureService;
    #ollamaClient: OllamaClient;
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #ollamaReplyService: OllamaReplyService;
    #ollamaStreamingReplyService: OllamaStreamingReplyService;
    #replyService: ReplyService;

    #context: Array<number> = [];

    constructor(
        environmentSettings: EnvironmentSettings,
        taskQueue: TaskQueue,
        featureService: FeatureService) {
        super(environmentSettings, taskQueue);

        this.environmentSettings = environmentSettings;

        this.#featureService = featureService;
        this.#ollamaClient = new OllamaClient(this.environmentSettings);
        this.#easyDiffusionClient = new EasyDiffusionClient(this.environmentSettings);
        this.#easyDiffusionReplyService = new EasyDiffusionReplyService(this.environmentSettings, this.#easyDiffusionClient, this.#featureService);
        this.#ollamaReplyService = new OllamaReplyService(this.environmentSettings, this.#easyDiffusionReplyService);
        this.#ollamaStreamingReplyService = new OllamaStreamingReplyService(this.environmentSettings, this.#easyDiffusionReplyService);
        this.#replyService = new ReplyService(environmentSettings, this.client);

        this.logger = new Logger(this.environmentSettings.isProduction, 'DiscordOllamaClient');

        this.#registerEvents();
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.client.once(Events.ClientReady, (event) => this.#onClientReady.call(self, event));
        this.client.on(Events.MessageCreate, async (message) => await this.#onMessageCreate.call(self, message));
    }

    #onClientReady(): Promise<void> {
        if(this.client.user === null) {
            return;
        }

        this.logger(LogLevel.Info, 'Client is ready.');
        this.client.user.setPresence({ activities: [], status: DiscordPresenceStatus.Online });
    }

    async #onMessageCreate(message: Message): Promise<void> {
        this.logger(LogLevel.Info, `Discord message created. ${message.author.displayName} (${message.author.username}): "${message}"`);

        if(!this.replyService.shouldReply(message)) {
            this.logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.logger(LogLevel.Info, 'Replying to message...');

        const promptResponseTask = new PromptResponseTask(
            this.environmentSettings,
            this.featureService,
            this.#ollamaClient,
            this.#ollamaReplyService,
            this.#ollamaStreamingReplyService,
            this.#replyService,
            this.client,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            message,
            this.#context);

        promptResponseTask.onSuccess = (context: Array<number>) => { this.#context = context; };

        await this.taskQueue.add(promptResponseTask);
    }
}
