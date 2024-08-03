import { Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { OllamaClient } from '../OllamaClient.js';
import { OllamaReplyService } from '../services/OllamaReplyService.js';
import { EasyDiffusionClient } from '../../easy-diffusion/EasyDiffusionClient.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { RenderRequest } from '../../easy-diffusion/models/requests/RenderRequest.js';
import { FeatureService } from '../../../features/FeatureService.js';
import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';
import { OllamaStreamingReplyService } from '../services/OllamaStreamingReplyService.js';
import { DiscordConstants } from '../../discord/enums/DiscordConstants.js';
import { IHttpExchangeWithAttachedResponse } from '../../../../models/IHttpExchangeWithAttachedResponse.js';
import { IRenderResponse } from '../../easy-diffusion/models/responses/IRenderResponse.js';
import { IStreamResponse } from '../../easy-diffusion/models/responses/IStreamResponse.js';

export class PromptResponseTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;
    #featureService: FeatureService;
    #ollamaClient: OllamaClient;
    #ollamaReplyService: OllamaReplyService;
    #ollamaStreamingReplyService: OllamaStreamingReplyService;
    #replyService: ReplyService;
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;

    #discordClient: DiscordClient;

    #message: Message;
    #context: Array<number> = [];

    #logger;

    #onSuccess: (context: Array<number>) => void  = () => { };

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

        this.#ollamaReplyService.reply(this.#message, exchange);

        if(this.#featureService.hasFeature(SupportedFeature.ImagesAttachedToText)) {
            const renderData = await this.#renderImage(exchange.response.response);
            await this.#ollamaReplyService.attachImage(renderData);
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
    }

    async #processAsStream(formattedMessage: string, context: Array<number>): Promise<void> {
        const exchange = await this.#ollamaClient.sendMessageAndGetStream(formattedMessage, context);

        let startTime = performance.now();
        let fullResponse = '';
        let responseBatch = '';

        for await (const response of exchange.response) {
            console.log(`Appending "${response.response}"`);
            responseBatch += response.response;

            if(performance.now() - startTime >= this.#environmentSettings.ollamaStreamResponseInterval
                / DiscordConstants.MaxRequestsPerSecond || response.done) {
                console.log('Flushing response batch.');

                await this.#ollamaStreamingReplyService.reply(this.#message, responseBatch);
                startTime = performance.now();
            }

            fullResponse += responseBatch;
            responseBatch = '';

            if(response.done) {
                this.#context = response.context;
            }
        }

        if(this.#featureService.hasFeature(SupportedFeature.ImagesAttachedToText)) {
            const renderData = await this.#renderImage(fullResponse);
            await this.#ollamaStreamingReplyService.attachImage(renderData);
        }
    }

    async #renderImage(imagePrompt: string): Promise<IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse>> {
        this.#logger(LogLevel.Info, 'An image will be attached to the Ollama response.');

        const model = this.#environmentSettings.easyDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.easyDiffusionModels) :
            getRandomArrayEntry(await this.#easyDiffusionClient.getModels());

        const renderRequest = new RenderRequest(model, imagePrompt);
        const renderData = await this.#easyDiffusionReplyService.renderImage(renderRequest);

        return renderData;
    }
}
