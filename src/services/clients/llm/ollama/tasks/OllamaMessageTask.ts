import { Message as DiscordMessage } from 'discord.js';
import { GenerateRequest, GenerateResponse, Message as OllamaMessage } from 'ollama';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { endsWithWhitespace, hasOnly, isOnlyWhitespace } from '../../../../../utilities/string-utilities.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { OLLAMA_TEMPERATURE_DEFAULT } from '../constants/OllamaConstants.js';
import { OllamaBaseTask } from './OllamaBaseTask.js';

export class OllamaMessageTask extends OllamaBaseTask<void> {
    readonly #services: IBotServiceContainer;

    readonly #featureService: IFeatureService;
    readonly #taskQueue: ITaskQueue;

    readonly #message: DiscordMessage;

    constructor(
        services: IBotServiceContainer,
        message: DiscordMessage) {
        super(services);
        this.logger = services.getLogger('OllamaMessageTask');

        this.#services = services;

        this.#featureService = services.featureService;
        this.#taskQueue = services.taskQueue;

        this.#message = message;
    }

    override async process(): Promise<void> {
        await super.process();

        const formattedMessage = `${this.#message.author.displayName}: ${this.replyService.getMessageWithoutBotMentions(this.#message)}`;
        const context = this.contextService.getContextByChannelId(this.#message.channelId);

        if (this.configurationService.ollamaStreamsResponse) {
            await this.#processAsStream(formattedMessage, context);
            return;
        }

        const exchange = await this.ollamaClient.sendMessage(formattedMessage, context);

        this.contextService.addContext([this.contextMessageFactory.fromChatMessage(this.#message)]);
        this.contextService.addContext([
            this.contextMessageFactory.fromLlmMessage(exchange.exchange.response.message,
                this.#message.id, this.#message.author.id, this.#message.channelId, this.#message.guildId)]);

        const replies = await this.ollamaReplyService.reply(this.#message, exchange.exchange);

        if (this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && replies.length > 0) {
            this.#attachImage(exchange.exchange.response.message.content, replies);
        }
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        switch (this.taskStatus) {
            case TaskStatus.Dead:
                await this.replyService.replyWithError(this.#message);
                break;
        }

        this.ollamaStreamingReplyService.clearState();
    }

    async #processAsStream(formattedMessage: string, context: OllamaMessage[]): Promise<void> {
        const exchange = await this.ollamaClient.sendMessageAndGetStream(formattedMessage, context);

        let averageResponseInMs = 0;
        let endTime = performance.now();

        let fullResponse = '';
        let responseBatch = '';

        if(!exchange?.exchange?.response) {
            return;
        }

        for await (const response of exchange.exchange.response) {
            const startTime = performance.now();
            let replies: DiscordMessage[] = [];

            fullResponse += response.message.content;
            responseBatch += response.message.content;

            if (!response.done) {
                // Ensure we're not sending requests faster than Discord can
                // allow or process them.
                if (startTime - endTime <= (DiscordConstants.MaxRequestsPerSecond / 1000)
                    || startTime - endTime < averageResponseInMs
                ) {
                    continue;
                }

                // Discord automatically trims message edits that are only whitespace.
                if (isOnlyWhitespace(responseBatch)) {
                    continue;
                }

                // If the message is appended with whitespace the end, Discord will
                // trim it, leading to an accumulation of formatting issues.
                if (endsWithWhitespace(responseBatch)) {
                    continue;
                }

                // Messages that only contain a double asterisk are, under certain
                // conditions, converted to a newline. This attempts to prevent that
                // by delaying the batch until additional characters are included.
                if (hasOnly(responseBatch, '*')) {
                    continue;
                }
            }

            replies = await this.ollamaStreamingReplyService.reply(this.#message, responseBatch, response.done);
            responseBatch = '';

            if (response.done) {
                this.contextService.addContext([this.contextMessageFactory.fromChatMessage(this.#message)]);
                this.contextService.addContext([
                    this.contextMessageFactory.fromLlmMessage(response.message,
                        this.#message.author.id,
                        this.#message.guildId,
                        this.#message.channelId,
                        this.#message.guildId
                    )]);

                if (this.#featureService.hasFeature(SupportedFeature.Txt2Img)
                    && replies.length > 0) {
                    this.#attachImage(fullResponse, replies);
                }
            }

            endTime = performance.now();
            averageResponseInMs = (averageResponseInMs + endTime - startTime) / 2;
            this.logger.debug(`The average streaming response time is ${averageResponseInMs}ms.`);
        }
    }

    #attachImage(prompt: string, replies: Array<DiscordMessage>): void {
        this.logger.info('An image will be attached to the Ollama response.');

        const lastReply = replies[replies.length - 1];

        if (!this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            this.#enqueueAttachmentTask(lastReply, prompt);
            return;
        }

        const llmImagePrompt = 'The following prompt is a response to a message.'
            + ' Describe an artistic or creative image to go with this response.'
            + ' Keep in mind that the image generation model that will receive this prompt can only accurately include brief snippets of text 2-3 words in length.'
            + ' If you do decide to include any text in the image, make sure to surround it with quotes and remain brief.'
            + `\n\n\`\`\`text\n${prompt}\n\`\`\``;

        const generateTask = this.#services.getLlmGenerateTask(llmImagePrompt, OLLAMA_TEMPERATURE_DEFAULT);
        generateTask.isChild = true;

        generateTask.onSuccess = (payload: IHttpExchange<GenerateRequest, GenerateResponse>): void => {
            this.#enqueueAttachmentTask(lastReply, payload.response.response);
        };

        generateTask.onFailure = (error: Error): void => {
            this.logger.error('Failed to generate an image for the prompt. Falling back to the original Ollama response to generate an image instead.', error);
            this.#enqueueAttachmentTask(lastReply, prompt);
        };

        this.#taskQueue.add(generateTask as BaseTask<unknown>);
    }

    #enqueueAttachmentTask(message: DiscordMessage, prompt: string): void {
        const attachTask = this.#services.getAttachmentTask(message, prompt) as BaseTask<void>;
        this.#taskQueue.add(attachTask as BaseTask<unknown>);
    }
}
