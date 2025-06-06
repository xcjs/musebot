import { Message as DiscordMessage } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { endsWithWhitespace, hasOnly, isOnlyWhitespace } from '../../../../../utilities/string-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { OllamaReplyService } from '../../../chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from '../../../chat/discord/ollama/OllamaStreamingReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IPromptResponseTask } from '../../tasks/IPromptResponseTask.js';
import { OllamaClient } from '../OllamaClient.js';

export class OllamaPromptResponseTask extends BaseTask<OllamaMessage[]> implements IPromptResponseTask {
    override get taskChannel(): string {
        return `${this.#environmentSettings.ollamaTaskChannel}_${this.#ollamaClient.host}`;
    }

    override set onSuccess(callback: (context: OllamaMessage[]) => void) {
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
    #logger: ILogger;

    #message: DiscordMessage;
    #context: OllamaMessage[] = [];

    #onSuccess: (context: OllamaMessage[]) => void = () => { };

    constructor(
        services: IServiceContainer,
        message: DiscordMessage,
        context: OllamaMessage[]) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#featureService = services.featureService;
        this.#ollamaClient = services.ollamaClient;
        this.#ollamaReplyService = services.ollamaReplyService;
        this.#ollamaStreamingReplyService = services.ollamaStreamingReplyService;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;
        this.#logger = services.getLogger('PromptResponseTask');

        this.#message = message;
        this.#context = context;
    }

    override async process(): Promise<void> {
        const formattedMessage = `${this.#message.author.displayName}: ${this.#replyService.getMessageWithoutBotMentions(this.#message)}`;

        if (this.#environmentSettings.ollamaStreamsResponse) {
            await this.#processAsStream(formattedMessage, this.#context);
            return;
        }

        const exchange = await this.#ollamaClient.sendMessage(formattedMessage, this.#context);
        this.#context = exchange.data;

        const replies = await this.#ollamaReplyService.reply(this.#message, exchange.exchange);

        if (this.#featureService.hasFeature(SupportedFeature.Txt2Img)
            && replies.length > 0) {
            await this.#attachImage(exchange.exchange.response.message.content, replies);
        }
    }

    override async postProcess(): Promise<void> {
        switch (this.taskStatus) {
            case TaskStatus.Dead:
                await this.#replyService.replyWithError(this.#message);
                break;
            case TaskStatus.Successful:
                this.#onSuccess(this.#context);
                break;
        }

        this.#ollamaStreamingReplyService.clearState();
    }

    async #processAsStream(formattedMessage: string, context: OllamaMessage[]): Promise<void> {
        const exchange = await this.#ollamaClient.sendMessageAndGetStream(formattedMessage, context);

        let averageResponseInMs = 0;
        let endTime = performance.now();

        let fullResponse = '';
        let responseBatch = '';

        for await (const response of exchange.exchange.response) {
            const startTime = performance.now();
            let replies: Array<DiscordMessage> = [];

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

            replies = await this.#ollamaStreamingReplyService.reply(this.#message, responseBatch, response.done);
            responseBatch = '';

            if (response.done) {
                this.#context = [...context, response.message];

                if (this.#featureService.hasFeature(SupportedFeature.Txt2Img)
                    && replies.length > 0) {
                    await this.#attachImage(fullResponse, replies);
                }
            }

            endTime = performance.now();
            averageResponseInMs = (averageResponseInMs + endTime - startTime) / 2;
            this.#logger.debug(`The average streaming response time is ${averageResponseInMs}ms.`);
        }
    }

    async #attachImage(prompt: string, replies: Array<DiscordMessage>): Promise<void> {
        this.#logger.info('An image will be attached to the Ollama response.');

        prompt = 'The following prompt is a response to a message.'
            + ' Describe an artistic or creative image to go with this response.'
            + ' Keep in mind that the image generation model that will receive this prompt can only accurately include brief snippets of text 2-3 words in length.'
            + ' If you do decide to include any text in the image, make sure to surround it with quotes and remain brief.'
            + `\n\n\`\`\`text\n${prompt}\n\`\`\``;

        const exchange = await this.#ollamaClient.sendMessage(prompt, this.#context);

        const lastReply = replies[replies.length - 1];
        const attachTask = this.#services.getAttachRenderTask(lastReply, exchange.exchange.response.message.content, lastReply.content) as BaseTask<void>;

        this.#taskQueue.add(attachTask);
    }
}
