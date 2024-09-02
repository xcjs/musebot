import { Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { Automatic1111ReplyService } from '../../discord/automatic1111/Automatic1111ReplyService.js';

export class JsonRenderTask extends BaseTask {
    #discordClient: DiscordClient;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #replyService: ReplyService;

    #message: Message;

    #logger;

    override get taskChannel(): string {
        return `Automatic1111_${this.#automatic1111ReplyService.host}`;
    }

    constructor(
        environmentSettings: EnvironmentSettings,
        discordClient: DiscordClient,
        automatic1111ReplyService: Automatic1111ReplyService,
        replyService: ReplyService,
        message: Message) {
        super(environmentSettings.maxTaskAttempts);

        this.#discordClient = discordClient;
        this.#automatic1111ReplyService = automatic1111ReplyService;
        this.#replyService = replyService;
        this.#message = message;

        this.#logger = new Logger(environmentSettings.isProduction, 'JsonRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a JsonRenderTask.');

        const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        const prompt = this.#message.content.replaceAll(botMention, '').trim();

        let request: SerializableRenderRequest;

        try {
            request = SerializableRenderRequest.fromJson(prompt);
        } catch {
           await this.#message.reply('You call that JSON? My grandmother could knit better JSON.');
           return;
        }

        const renderData = await this.#automatic1111ReplyService.renderImage(request.toTxt2ImgOptionsRequest(), request.model);
        await this.#automatic1111ReplyService.reply(this.#message, renderData);
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Failed) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
