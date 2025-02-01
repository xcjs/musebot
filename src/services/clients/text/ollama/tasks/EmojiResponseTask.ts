import { Message, MessageReaction, User } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { OllamaReplyService } from '../../../chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from '../../../chat/discord/ollama/OllamaStreamingReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IEmojiResponseTask } from '../../tasks/IEmojiResponseTask.js';
import { OllamaClient } from '../OllamaClient.js';

export class EmojiResponseTask extends BaseTask implements IEmojiResponseTask {
    override get taskChannel(): string {
        return `Ollama_${this.#ollamaClient.host}`;
    }

    override set onSuccess(callback: (context: Array<number>) => void) {
        this.#onSuccess = callback;
    }

    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #featureService: IFeatureService;
    #ollamaClient: OllamaClient;
    #ollamaReplyService: OllamaReplyService;
    #ollamaStreamingReplyService: OllamaStreamingReplyService;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #reaction: MessageReaction;
    #user: User;
    #context: Array<number>;

    #logger;

    #onSuccess: (context: Array<number>) => void = () => { };

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
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#reaction = reaction;
        this.#user = user;
        this.#context = context;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'PromptResponseTask');
    }

    override async process(): Promise<void> {
        const mention = this.#replyService.mention(this.#user);
        const prompt = `${mention} reacted to your response with ${this.#reaction.emoji.name}. React to them regarding their reaction.`

        if (this.#environmentSettings.ollamaStreamsResponse) {
            await this.#processAsStream(prompt, this.#context);
            return;
        }

        const exchange = await this.#ollamaClient.sendMessage(prompt, this.#context);
        this.#context = exchange.response.context;

        const replies = await this.#ollamaReplyService.reply(this.#reaction.message as Message, exchange, mention);

        if (this.#featureService.hasFeature(SupportedFeature.ImagesAndText)
            && replies.length > 0) {
            this.#attachImage(exchange.response.response, replies);
        }
    }

    override async postProcess(): Promise<void> {
        switch (this.taskStatus) {
            case TaskStatus.Dead:
                await this.#replyService.replyWithError(this.#reaction.message as Message);
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
