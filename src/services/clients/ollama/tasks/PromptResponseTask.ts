import { Client as DiscordClient, Message } from 'discord.js';
import { Logger } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { OllamaClient } from '../OllamaClient.js';
import { OllamaReplyService } from '../services/OllamaReplyService.js';
import { EasyDiffusionClient } from '../../easy-diffusion/EasyDiffusionClient.js';

export class PromptResponseTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;
    #ollamaReplyService: OllamaReplyService;
    #replyService: ReplyService;

    #discordClient: DiscordClient;

    #message: Message;
    #context: Array<number>;

    #logger;

    constructor(
        environmentSettings: EnvironmentSettings,
        ollamaReplyService: OllamaReplyService,
        replyService: ReplyService,
        discordClient: DiscordClient,
        message: Message,
        context: Array<number>) {
        super();

        this.#environmentSettings = environmentSettings;
        this.#ollamaReplyService = ollamaReplyService;
        this.#replyService = replyService;

        this.#discordClient = discordClient;
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

        await this.#ollamaReplyService.reply(this.#message, exchange);

        this.taskStatus = TaskStatus.Successful;
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Failed) {
            await this.#replyService.replyWithError(this.#message);
        }
    }

    async #renderImage(imagePrompt: string): Promise<void> {
        const easyDiffusionClient = new EasyDiffusionClient(this.#environmentSettings);
        this.easyDiffusionClients.push(easyDiffusionClient);

        this.logger(LogLevel.Info, `Image render prompt: ${imagePrompt}`);

        const model = this.easyDiffusionClients.length > 0 ?
            getRandomArrayEntry(this.environmentSettings.easyDiffusionModels) :
            getRandomArrayEntry(await easyDiffusionClient.getModels());

        const renderExchange = await easyDiffusionClient.render(new RenderRequest(model, imagePrompt));

        if(renderExchange === null || renderExchange.response === null) {
            return;
        }

        const streamResponse = await easyDiffusionClient.stream(renderExchange);

        if(streamResponse === null) {
            return;
        }

        const renderRequest = renderExchange.request;
    }
}
