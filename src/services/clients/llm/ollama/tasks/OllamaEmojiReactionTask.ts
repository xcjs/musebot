import { Message as DiscordMessage, MessageReaction, User } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IBotServiceContainer } from "../../../../IServiceContainer.js"
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { OllamaBaseTask } from './OllamaBaseTask.js';

export class OllamaEmojiReactionTask extends OllamaBaseTask<void> {
    readonly #services: IBotServiceContainer;

    readonly #featureService: IFeatureService;
    readonly #taskQueue: ITaskQueue;

    readonly #reaction: MessageReaction;
    readonly #user: User;

    constructor(
        services: IBotServiceContainer,
        reaction: MessageReaction,
        user: User) {
        super(services);
        this.logger = services.getLogger('OllamaEmojiReactionTask');

        this.#services = services;

        this.#featureService = services.featureService;
        this.#taskQueue = services.taskQueue;

        this.#reaction = reaction;
        this.#user = user;
    }

    override async process(): Promise<void> {
        const userMention = this.replyService.mention(this.#user);
        const prompt = `${userMention} reacted to your response with ${this.#reaction.emoji.name}. React to them regarding their reaction.`
        const context = this.contextService.getContextByChannelId(this.#reaction.message.channelId);

        if (this.environmentSettings.ollamaStreamsResponse) {
            await this.#processAsStream(prompt, context);
            return;
        }

        const exchange = await this.ollamaClient.sendMessage(prompt, context);

        this.contextService.addContext([
            this.contextMessageFactory.fromChatPrompt(prompt,
                this.#user.id,
                this.#reaction.message.guildId,
                this.#reaction.message.channelId,
                this.#reaction.message.id)]);

        this.contextService.addContext([
            this.contextMessageFactory.fromLlmMessage(exchange.exchange.response.message,
                this.#user.id,
                this.#reaction.message.guildId,
                this.#reaction.message.channelId,
                this.#reaction.message.id
            )]);

        const replies = await this.ollamaReplyService.reply(this.#reaction.message as DiscordMessage, exchange.exchange, userMention);

        if (this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && replies.length > 0) {
            this.#attachImage(exchange.exchange.response.message.content, replies);
        }
    }

    override async postProcess(): Promise<void> {
        switch (this.taskStatus) {
            case TaskStatus.Dead:
                await this.replyService.replyWithError(this.#reaction.message as DiscordMessage);
                break;
        }

        this.ollamaStreamingReplyService.clearState();
    }

    async #processAsStream(prompt: string, context: OllamaMessage[]): Promise<void> {
        const exchange = await this.ollamaClient.sendMessageAndGetStream(prompt, context);

        let startTime = performance.now();
        let fullResponse = '';
        let responseBatch = '';

        if(!exchange?.exchange?.response) {
            return;
        }

        for await (const response of exchange.exchange.response) {
            this.logger.info(`Appending "${response.message.content}"`);

            let replies: DiscordMessage[] = [];
            responseBatch += response.message.content;

            if (performance.now() - startTime >= 1000
                / DiscordConstants.MaxRequestsPerSecond || response.done) {
                this.logger.info('Flushing response batch.');

                replies = await this.ollamaStreamingReplyService.reply(this.#reaction.message as DiscordMessage, responseBatch, !!response.done);
                startTime = performance.now();

                fullResponse += responseBatch;
                responseBatch = '';
            }

            if (response.done) {
                this.contextService.addContext([
                    this.contextMessageFactory.fromChatPrompt(prompt,
                        this.#user.id,
                        this.#reaction.message.guildId,
                        this.#reaction.message.channelId,
                        this.#reaction.message.id)]);

                this.contextService.addContext([
                    this.contextMessageFactory.fromLlmMessage(response.message,
                        this.#user.id,
                        this.#reaction.message.guildId,
                        this.#reaction.message.channelId,
                        this.#reaction.message.id
                    )]);

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

        this.#taskQueue.add(attachTask as BaseTask<unknown>);
    }
}
