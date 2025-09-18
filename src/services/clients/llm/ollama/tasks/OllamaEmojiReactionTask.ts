import { Message as DiscordMessage, MessageReaction, User } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ApiResourceType } from '../../../../parallelization/ApiResourceType.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { OllamaReplyService } from '../../../chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from '../../../chat/discord/ollama/OllamaStreamingReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { OllamaClient } from '../OllamaClient.js';

export class OllamaEmojiReactionTask extends BaseTask<OllamaMessage[]> {
    override get taskChannel(): string {
        return this.parallelizationStrategy.getTaskChannel(ApiResourceType.LargeLanguageModel, this.#ollamaClient.host);
    }

    override set onSuccess(callback: (payload: OllamaMessage[]) => void) {
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
    #context: OllamaMessage[];

    #onSuccess: (payload: OllamaMessage[]) => void = () => { };

    constructor(
        services: IServiceContainer,
        reaction: MessageReaction,
        user: User,
        context: OllamaMessage[]) {
        super(services);
        this.logger = services.getLogger('OllamaEmojiReactionTask');

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
    }

    override async process(): Promise<void> {
        const mention = this.#replyService.mention(this.#user);
        const prompt = `${mention} reacted to your response with ${this.#reaction.emoji.name}. React to them regarding their reaction.`

        if (this.#environmentSettings.ollamaStreamsResponse) {
            await this.#processAsStream(prompt, this.#context);
            return;
        }

        const exchange = await this.#ollamaClient.sendMessage(prompt, this.#context);
        this.#context = exchange.data;

        const replies = await this.#ollamaReplyService.reply(this.#reaction.message as DiscordMessage, exchange.exchange, mention);

        if (this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && replies.length > 0) {
            this.#attachImage(exchange.exchange.response.message.content, replies);
        }
    }

    override async postProcess(): Promise<void> {
        switch (this.taskStatus) {
            case TaskStatus.Dead:
                await this.#replyService.replyWithError(this.#reaction.message as DiscordMessage);
                break;
            case TaskStatus.Successful:
                this.#onSuccess(this.#context);
                break;
        }

        this.#ollamaStreamingReplyService.clearState();
    }

    async #processAsStream(formattedPrompt: string, context: OllamaMessage[]): Promise<void> {
        const exchange = await this.#ollamaClient.sendMessageAndGetStream(formattedPrompt, context);

        let startTime = performance.now();
        let fullResponse = '';
        let responseBatch = '';

        for await (const response of exchange.exchange.response) {
            this.logger.info(`Appending "${response.message.content}"`);

            let replies: DiscordMessage[] = [];
            responseBatch += response.message.content;

            if (performance.now() - startTime >= 1000
                / DiscordConstants.MaxRequestsPerSecond || response.done) {
                this.logger.info('Flushing response batch.');

                replies = await this.#ollamaStreamingReplyService.reply(this.#reaction.message as DiscordMessage, responseBatch, !!response.done);
                startTime = performance.now();

                fullResponse += responseBatch;
                responseBatch = '';
            }

            if (response.done) {
                this.#context = [...context, response.message];

                if (this.#featureService.hasFeature(SupportedFeature.Txt2Img)
                    && replies.length > 0) {
                    this.#attachImage(fullResponse, replies);
                }
            }
        }
    }

    #attachImage(prompt: string, replies: DiscordMessage[]): void {
        this.logger.info('An image will be attached to the Ollama response.');

        const lastReply = replies[replies.length - 1];
        const attachTask = this.#services.getAttachmentTask(lastReply, prompt) as BaseTask<void>;

        this.#taskQueue.add(attachTask);
    }
}
