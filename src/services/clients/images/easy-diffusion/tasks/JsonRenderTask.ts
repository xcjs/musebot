import { Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from 'services/tasks/models/BaseTask.js';
import { RenderRequest } from 'services/clients/images/easy-diffusion/models/requests/RenderRequest.js';
import { TaskStatus } from 'services/tasks/enums/TaskStatus.js';
import { EasyDiffusionReplyService } from 'services/clients/chat/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { ReplyService } from 'services/clients/chat/discord/ReplyService.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings.js';

export class JsonRenderTask extends BaseTask {
    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #replyService: ReplyService;

    #message: Message;

    #logger;

    override get taskChannel(): string {
        return `EasyDiffusion_${this.#easyDiffusionReplyService.host}`;
    }

    constructor(services: IServiceContainer, message: Message) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#easyDiffusionReplyService = services.easyDiffusionReplyService;
        this.#replyService = services.replyService;

        this.#message = message;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'JsonRenderTask');
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
        await this.#easyDiffusionReplyService.reply(this.#message, renderData);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
