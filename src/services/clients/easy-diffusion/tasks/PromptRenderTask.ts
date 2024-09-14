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
import { ReplyService } from '../../discord/services/ReplyService.js';

export class PromptRenderTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;
    #discordClient: DiscordClient;
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #replyService: ReplyService;
    #taskQueue: TaskQueue;

    #message: Message;

    #logger;

    override get taskChannel(): string {
        return `EasyDiffusion_${this.#easyDiffusionClient.host}`;
    }

    constructor(
        environmentSettings: EnvironmentSettings,
        discordClient: DiscordClient,
        easyDiffusionClient: EasyDiffusionClient,
        easyDiffusionReplyService: EasyDiffusionReplyService,
        replyService: ReplyService,
        message: Message,
        taskQueue: TaskQueue) {
        super(environmentSettings.maxTaskAttempts);

        this.#environmentSettings = environmentSettings;
        this.#discordClient = discordClient;
        this.#easyDiffusionClient = easyDiffusionClient;
        this.#easyDiffusionReplyService = easyDiffusionReplyService;
        this.#replyService = replyService;
        this.#message = message;
        this.#taskQueue = taskQueue;

        this.#logger = new Logger(environmentSettings.isProduction, 'PromptRenderTask');
    }

    override async process(): Promise<void> {
        const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        const prompt = this.#message.content.replaceAll(botMention, '').trim();

        if(prompt.charAt(0) === '{') {
            this.#taskQueue.add(new JsonRenderTask(
                this.#environmentSettings,
                this.#discordClient,
                this.#easyDiffusionReplyService,
                this.#replyService,
                this.#message));
            return;
        }

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#easyDiffusionClient.getModels());

        this.#logger(LogLevel.Info, `Using ${model} as the selected EasyDiffusion model.`);

        const request = new RenderRequest(model, prompt);

        const renderData = await this.#easyDiffusionReplyService.renderImage(request);
        await this.#easyDiffusionReplyService.reply(this.#message, renderData);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
