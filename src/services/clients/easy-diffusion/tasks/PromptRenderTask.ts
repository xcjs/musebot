import { Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { EasyDiffusionClient } from '../EasyDiffusionClient.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';
import { TaskQueue } from '../../../tasks/services/TaskQueue.js';
import { JsonRenderTask } from './JsonRenderTask.js';

export class PromptRenderTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;
    #discordClient: DiscordClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #easyDiffusionClient: EasyDiffusionClient;
    #taskQueue: TaskQueue;

    #message: Message;

    #logger;

    constructor(
        environmentSettings: EnvironmentSettings,
        discordClient: DiscordClient,
        easyDiffusionClient: EasyDiffusionClient,
        easyDiffusionReplyService: EasyDiffusionReplyService,
        message: Message,
        taskQueue: TaskQueue) {
        super();

        this.#environmentSettings = environmentSettings;
        this.#discordClient = discordClient;
        this.#easyDiffusionClient = easyDiffusionClient;
        this.#easyDiffusionReplyService = easyDiffusionReplyService;
        this.#message = message;
        this.#taskQueue = taskQueue;

        this.#logger = new Logger(environmentSettings.isProduction, 'PromptRenderTask');
    }

    override async process(): Promise<void> {
        this.taskStatus = TaskStatus.Busy;

        const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        const prompt = this.#message.content.replaceAll(botMention, '').trim();

        if(prompt.charAt(0) === '{') {
            this.#taskQueue.add(new JsonRenderTask(
                this.#environmentSettings,
                this.#discordClient,
                this.#easyDiffusionClient,
                this.#easyDiffusionReplyService,
                this.#message));

            this.taskStatus = TaskStatus.Complete;
            return;
        }

        const model = this.#environmentSettings.easyDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.easyDiffusionModels) :
            getRandomArrayEntry(await this.#easyDiffusionClient.getModels());

        this.#logger(LogLevel.Info, `Using ${model} as the selected EasyDiffusion model.`);

        const request = new RenderRequest(model, prompt);

        const renderData = await this.#easyDiffusionReplyService.renderImage(request);
        await this.#easyDiffusionReplyService.reply(this.#message, renderData, null, null);

        this.taskStatus = TaskStatus.Successful;
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Failed) {
            await this.#easyDiffusionReplyService.replyWithError(this.#message);
        }
    }
}
