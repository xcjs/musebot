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

export class PromptResponseTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;
    #featureService: FeatureService;
    #ollamaReplyService: OllamaReplyService;
    #replyService: ReplyService;
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;

    #discordClient: DiscordClient;

    #message: Message;
    #context: Array<number> = [];

    #logger;

    get context() {
        return this.#context;
    }

    constructor(
        environmentSettings: EnvironmentSettings,
        featureService: FeatureService,
        ollamaReplyService: OllamaReplyService,
        replyService: ReplyService,
        discordClient: DiscordClient,
        easyDiffusionClient: EasyDiffusionClient,
        easyDiffusionReplyService: EasyDiffusionReplyService,
        message: Message,
        context: Array<number>) {
        super();

        this.#environmentSettings = environmentSettings;
        this.#featureService = featureService;
        this.#ollamaReplyService = ollamaReplyService;
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

        const ollamaClient = new OllamaClient(this.#environmentSettings);
        const context = this.#context;

        const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        const formattedMessage = `${this.#message.author.displayName}: ${this.#message.content.replaceAll(botMention, '')}`;

        const exchange = await ollamaClient.sendMessage(formattedMessage, context);
        await this.#renderImage(exchange.response.response);

        this.taskStatus = TaskStatus.Successful;
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Failed) {
            await this.#replyService.replyWithError(this.#message);
        }
    }

    async #renderImage(imagePrompt: string): Promise<void> {
        if(!this.#featureService.hasFeature(SupportedFeature.ImagesAttachedToText)) {
            return Promise.resolve();
        }

        this.#logger(LogLevel.Info, 'An image will be attached to the Ollama response.');

        const model = this.#environmentSettings.easyDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.easyDiffusionModels) :
            getRandomArrayEntry(await this.#easyDiffusionClient.getModels());

        const renderRequest = new RenderRequest(model, imagePrompt);
        const renderData = await this.#easyDiffusionReplyService.renderImage(renderRequest);

        await this.#ollamaReplyService.attachImage(renderData);
    }
}
