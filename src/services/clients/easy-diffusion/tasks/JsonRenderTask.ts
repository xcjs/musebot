import { Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';
import { ReplyService } from '../../discord/services/ReplyService.js';

export class JsonRenderTask extends BaseTask {
    #discordClient: DiscordClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #replyService: ReplyService;

    #message: Message;

    #logger;

    override get taskChannel(): string {
        return `EasyDiffusion_${this.#easyDiffusionReplyService.easyDiffusionHost}`;
    }

    constructor(
        environmentSettings: EnvironmentSettings,
        discordClient: DiscordClient,
        easyDiffusionReplyService: EasyDiffusionReplyService,
        replyService: ReplyService,
        message: Message) {
        super(environmentSettings.maxTaskAttempts);

        this.#discordClient = discordClient;
        this.#easyDiffusionReplyService = easyDiffusionReplyService;
        this.#replyService = replyService;
        this.#message = message;

        this.#logger = new Logger(environmentSettings.isProduction, 'JsonRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a JsonRenderTask.');

        const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        const prompt = this.#message.content.replaceAll(botMention, '').trim();

        let request: RenderRequest;

        try {
            request = RenderRequest.fromJson(prompt);
            request.num_outputs = 1;
        } catch {
           await this.#message.reply('You call that JSON? My grandmother could knit better JSON.');
           return;
        }

        const renderData = await this.#easyDiffusionReplyService.renderImage(request);
        await this.#easyDiffusionReplyService.reply(this.#message, renderData, null, null);
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Failed) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
