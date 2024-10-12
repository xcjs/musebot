import { Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { DiscordConstants } from 'services/clients/chat/discord/enums/DiscordConstants';
import { OllamaReplyService } from 'services/clients/chat/discord/ollama/OllamaReplyService';
import { OllamaStreamingReplyService } from 'services/clients/chat/discord/ollama/OllamaStreamingReplyService';
import { ReplyService } from 'services/clients/chat/discord/ReplyService';
import { StableDiffusionApiType } from 'services/clients/images/stable-diffusion/enums/StableDiffusionApiType';
import { SupportedFeature } from 'services/features/enum/SupportedFeature';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings';
import { IServiceContainer } from 'services/IServiceContainer';
import { TaskStatus } from 'services/tasks/enums/TaskStatus';
import { BaseTask } from 'services/tasks/models/BaseTask';
import { TaskQueue } from 'services/tasks/TaskQueue';
import { OllamaClient } from '../OllamaClient';
import { IFeatureService } from 'services/features/IFeatureService';
import { AttachRenderTask as A1AttachRenderTask } from 'services/clients/images/automatic1111/tasks/AttachRenderTask';
import { AttachRenderTask as EdAttachRenderTask } from 'services/clients/images/easy-diffusion/tasks/AttachRenderTask';

export class PromptResponseTask extends BaseTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #featureService: IFeatureService;
    #ollamaClient: OllamaClient;
    #ollamaReplyService: OllamaReplyService;
    #ollamaStreamingReplyService: OllamaStreamingReplyService;
    #discordClient: DiscordClient;
    #replyService: ReplyService;
    #taskQueue: TaskQueue;

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
        services: IServiceContainer,
        message: Message,
        context: Array<number>) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#featureService = services.featureService;
        this.#ollamaClient = services.ollamaClient;
        this.#ollamaReplyService = services.ollamaReplyService;
        this.#ollamaStreamingReplyService = services.ollamaStreamingReplyService;
        this.#discordClient = services.discordClient;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#message = message;
        this.#context = context;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'PromptResponseTask');
    }

    override async process(): Promise<void> {
        const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        const formattedMessage = `${this.#message.author.displayName}: ${this.#message.content.replaceAll(botMention, '').trim()}`;

        if(this.#environmentSettings.ollamaStreamsResponse) {
            await this.#processAsStream(formattedMessage, this.#context);
            return;
        }

        const exchange = await this.#ollamaClient.sendMessage(formattedMessage, this.#context);
        this.#context = exchange.response.context;

        const replies = await this.#ollamaReplyService.reply(this.#message, exchange);

        if(this.#featureService.hasFeature(SupportedFeature.ImagesAndText)
            && replies.length > 0) {
            this.#attachImage(exchange.response.response, replies);
        }
    }

    override async postProcess(): Promise<void> {
        switch(this.taskStatus) {
            case TaskStatus.Dead:
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

                if(this.#featureService.hasFeature(SupportedFeature.ImagesAndText)
                    && replies.length > 0) {
                    this.#attachImage(fullResponse, replies);
                }
            }
        }
    }

    #attachImage(prompt: string, replies: Array<Message>): void {
        this.#logger(LogLevel.Info, 'An image will be attached to the Ollama response.');

        const lastReply = replies[replies.length - 1];

        let renderTask: BaseTask;

        if(this.#environmentSettings.stableDiffusionApiType === StableDiffusionApiType.EasyDiffusion) {
            renderTask = new EdAttachRenderTask(
                this.#services,
                lastReply,
                prompt,
                lastReply.content,
                true);
        } else {
            renderTask = new A1AttachRenderTask(
                this.#services,
                lastReply,
                prompt,
                lastReply.content,
                true);
        }

        this.#taskQueue.add(renderTask);
    }
}
