import { Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from 'services/tasks/models/BaseTask.js';
import { TaskStatus } from 'services/tasks/enums/TaskStatus.js';
import { ReplyService } from 'services/clients/chat/discord/ReplyService.js';
import { SerializableRenderRequest } from 'services/clients/images/stable-diffusion/models/SerializableRenderRequest.js';
import { Automatic1111ReplyService } from 'services/clients/chat/discord/automatic1111/Automatic1111ReplyService.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings.js';

export class JsonRenderTask extends BaseTask {
    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #replyService: ReplyService;

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
