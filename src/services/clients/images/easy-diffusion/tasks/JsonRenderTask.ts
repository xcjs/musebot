import { Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { EasyDiffusionReplyService } from '../../../chat/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IJsonRenderTask } from '../../tasks/IJsonRenderTask.js';

export class JsonRenderTask extends BaseTask implements IJsonRenderTask {
    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #replyService: IReplyService;

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
