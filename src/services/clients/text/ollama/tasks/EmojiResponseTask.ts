import { Client as DiscordClient, Message, MessageReaction, User } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { OllamaReplyService } from '../../../chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from '../../../chat/discord/ollama/OllamaStreamingReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IEmojiResponseTask } from '../../tasks/IEmojiResponseTask.js';
import { OllamaClient } from '../OllamaClient.js';

export class EmojiResponseTask extends BaseTask implements IEmojiResponseTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #featureService: IFeatureService;
    #ollamaClient: OllamaClient;
    #ollamaReplyService: OllamaReplyService;
    #ollamaStreamingReplyService: OllamaStreamingReplyService;
    #discordClient: DiscordClient;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #reaction: MessageReaction;
    #user: User;
    #context: Array<number>;

    #logger;

    override get taskChannel(): string {
        return `Ollama_${this.#ollamaClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        reaction: MessageReaction,
        user: User,
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

        this.#reaction = reaction;
        this.#user = user;
        this.#context = context;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'PromptResponseTask');
    }

    override async process(): Promise<void> {
        if (this.#reaction.partial) {
            try {
                this.#reaction = await this.#reaction.fetch();
            } catch (error) {
                this.#logger(LogLevel.Error, `Something went wrong when fetching the MessageReaction:`, error);
                return;
            }
        }

        const prompt = `${this.#replyService.mention(this.#user)} reacted to your response with ${this.#reaction.emoji.name}.`

        if (this.#environmentSettings.ollamaStreamsResponse) {
            await this.#processAsStream(prompt, this.#context);
            return;
        }

        const exchange = await this.#ollamaClient.sendMessage(prompt, this.#context);
        this.#context = exchange.response.context;

        const replies = await this.#ollamaReplyService.reply(this.#reaction.message as Message, exchange);

        if (this.#featureService.hasFeature(SupportedFeature.ImagesAndText)
            && replies.length > 0) {
            this.#attachImage(exchange.response.response, replies);
        }
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

            if (performance.now() - startTime >= 1000
                / DiscordConstants.MaxRequestsPerSecond || response.done) {
                console.log('Flushing response batch.');

                replies = await this.#ollamaStreamingReplyService.reply(this.#reaction.message as Message, responseBatch, !!response.done);
                startTime = performance.now();

                fullResponse += responseBatch;
                responseBatch = '';
            }

            if (response.done) {
                this.#context = response.context;

                if (this.#featureService.hasFeature(SupportedFeature.ImagesAndText)
                    && replies.length > 0) {
                    this.#attachImage(fullResponse, replies);
                }
            }
        }
    }

    #attachImage(prompt: string, replies: Array<Message>): void {
        this.#logger(LogLevel.Info, 'An image will be attached to the Ollama response.');

        const lastReply = replies[replies.length - 1];
        const attachTask = this.#services.getAttachRenderTask(lastReply, prompt, lastReply.content, true) as BaseTask;

        this.#taskQueue.add(attachTask);
    }
}
