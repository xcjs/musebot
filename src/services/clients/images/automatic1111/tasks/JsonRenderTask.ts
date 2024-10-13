import { Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { Automatic1111ReplyService } from '../../../chat/discord/automatic1111/Automatic1111ReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IReplyService } from '../../../chat/IReplyService.js';

export class JsonRenderTask extends BaseTask {
    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #replyService: IReplyService;

    #message: Message;

    #logger;

    override get taskChannel(): string {
        return `Automatic1111_${this.#automatic1111ReplyService.host}`;
    }

    constructor(
        services: IServiceContainer,
        message: Message) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#automatic1111ReplyService = services.automatic1111ReplyService;
        this.#replyService = services.replyService;
        this.#message = message;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'JsonRenderTask');
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
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
