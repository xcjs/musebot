import { Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { OllamaClient } from '../OllamaClient.js';
import { OllamaReplyService } from '../services/OllamaReplyService.js';
import { EasyDiffusionClient } from '../../easy-diffusion/EasyDiffusionClient.js';
import { FeatureService } from '../../../features/FeatureService.js';
import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';
import { OllamaStreamingReplyService } from '../services/OllamaStreamingReplyService.js';
import { DiscordConstants } from '../../discord/enums/DiscordConstants.js';
import { TaskQueue } from '../../../tasks/services/TaskQueue.js';
import { AttachRenderTask } from '../../easy-diffusion/tasks/AttachRenderTask.js';

export class PromptResponseTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;
    #featureService: FeatureService;
    #ollamaClient: OllamaClient;
    #ollamaReplyService: OllamaReplyService;
    #ollamaStreamingReplyService: OllamaStreamingReplyService;
    #replyService: ReplyService;
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #taskQueue: TaskQueue;

    #discordClient: DiscordClient;

    #message: Message;
    #context: Array<number> = [];

    #logger;

    #onSuccess: (context: Array<number>) => void  = () => { };

    override get taskChannel(): string {
        return `Ollama_${this.#ollamaClient.host}`;
    }

    set onSuccess(callback: (context: Array<number>) => void) {
        this.#onSuccess = callback;
    }

    constructor(
        environmentSettings: EnvironmentSettings,
        featureService: FeatureService,
        ollamaClient: OllamaClient,
        ollamaReplyService: OllamaReplyService,
        ollamaStreamingReplyService: OllamaStreamingReplyService,
        replyService: ReplyService,
        discordClient: DiscordClient,
        easyDiffusionClient: EasyDiffusionClient,
        easyDiffusionReplyService: EasyDiffusionReplyService,
        taskQueue: TaskQueue,
        message: Message,
        context: Array<number>) {
        super();

        this.#environmentSettings = environmentSettings;
        this.#featureService = featureService;
        this.#ollamaClient = ollamaClient;
        this.#ollamaReplyService = ollamaReplyService;
        this.#ollamaStreamingReplyService  = ollamaStreamingReplyService;
        this.#replyService = replyService;
        this.#discordClient = discordClient;
        this.#easyDiffusionClient = easyDiffusionClient;
        this.#easyDiffusionReplyService = easyDiffusionReplyService;
        this.#taskQueue = taskQueue;

        this.#message = message;
        this.#context = context;

        this.#logger = new Logger(environmentSettings.isProduction, 'PromptResponseTask');
    }

    override async process(): Promise<void> {
        this.taskStatus = TaskStatus.Busy;

        const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        const formattedMessage = `${this.#message.author.displayName}: ${this.#message.content.replaceAll(botMention, '').trim()}`;

        if(this.#environmentSettings.ollamaStreamsResponse) {
            await this.#processAsStream(formattedMessage, this.#context);
            return;
        }

        const exchange = await this.#ollamaClient.sendMessage(formattedMessage, this.#context);
        this.#context = exchange.response.context;

        const replies = await this.#ollamaReplyService.reply(this.#message, exchange);

        if(this.#featureService.hasFeature(SupportedFeature.ImagesAttachedToText)
            && replies.length > 0) {
            this.#attachImage(exchange.response.response, replies);
        }

        this.taskStatus = TaskStatus.Successful;
    }

    override async postProcess(): Promise<void> {
        switch(this.taskStatus) {
            case TaskStatus.Failed:
                await this.#replyService.replyWithError(this.#message);
                break;
            case TaskStatus.Successful:
                this.#onSuccess(this.#context);
                break;
        }

        this.#ollamaStreamingReplyService.clearState();
    }

    async #processAsStream(formattedMessage: string, context: Array<number>): Promise<void> {
        const exchange = await this.#ollamaClient.sendMessageAndGetStream(formattedMessage, context);

        let startTime = performance.now();
        let fullResponse = '';
        let responseBatch = '';

        for await (const response of exchange.response) {
            console.log(`Appending "${response.response}"`);

            let replies: Array<Message> = [];
            responseBatch += response.response;

            if(performance.now() - startTime >= 1000
                / DiscordConstants.MaxRequestsPerSecond || response.done) {
                console.log('Flushing response batch.');

                replies = await this.#ollamaStreamingReplyService.reply(this.#message, responseBatch, !!response.done);
                startTime = performance.now();

                fullResponse += responseBatch;
                responseBatch = '';
            }

            if(response.done) {
                this.#context = response.context;

                if(this.#featureService.hasFeature(SupportedFeature.ImagesAttachedToText)
                    && replies.length > 0) {
                    this.#attachImage(fullResponse, replies);
                }
            }
        }
    }

    #attachImage(prompt: string, replies: Array<Message>): void {
        this.#logger(LogLevel.Info, 'An image will be attached to the Ollama response.');

        const lastReply = replies[replies.length - 1];
        const renderTask = new AttachRenderTask(
            this.#environmentSettings,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            this.#replyService,
            lastReply,
            prompt);

        this.#taskQueue.add(renderTask);
    }
}
