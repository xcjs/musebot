import { Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { Automatic1111Client } from '../Automatic1111Client.js';
import { Automatic1111ReplyService } from '../../discord/automatic1111/Automatic1111ReplyService.js';
import { Txt2ImgOptionsFactory } from '../factories/Txt2ImgOptionsFactory.js';
import { TaskQueue } from '../../../tasks/services/TaskQueue.js';
import { JsonRenderTask } from './JsonRenderTask.js';

export class PromptRenderTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;
    #discordClient: DiscordClient;
    #automatic1111Client: Automatic1111Client;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #replyService: ReplyService;
    #taskQueue: TaskQueue;

    #message: Message;

    #logger;

    override get taskChannel(): string {
        return `Automatic1111_${this.#automatic1111Client.host}`;
    }

    constructor(
        environmentSettings: EnvironmentSettings,
        discordClient: DiscordClient,
        automatic1111Client: Automatic1111Client,
        automatic1111ReplyService: Automatic1111ReplyService,
        replyService: ReplyService,
        taskQueue: TaskQueue,
        message: Message) {
        super(environmentSettings.maxTaskAttempts);

        this.#environmentSettings = environmentSettings;
        this.#discordClient = discordClient;
        this.#automatic1111Client = automatic1111Client;
        this.#automatic1111ReplyService = automatic1111ReplyService;
        this.#replyService = replyService;
        this.#taskQueue = taskQueue;
        this.#message = message;

        this.#logger = new Logger(environmentSettings.isProduction, 'PromptRenderTask');
    }

    override async process(): Promise<void> {
        const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        const prompt = this.#message.content.replaceAll(botMention, '').trim();

        if(prompt.charAt(0) === '{') {
            this.#taskQueue.add(new JsonRenderTask(
                this.#environmentSettings,
                this.#discordClient,
                this.#automatic1111ReplyService,
                this.#replyService,
                this.#message));
            return;
        }

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#automatic1111Client.getModels()).title;

        this.#logger(LogLevel.Info, `Using ${model} as the selected Automatic1111 model.`);

        const request = Txt2ImgOptionsFactory.getCurrentModelSettings(model, prompt);

        const renderData = await this.#automatic1111Client.render(request, model);
        await this.#automatic1111ReplyService.reply(this.#message, renderData);
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Failed) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
