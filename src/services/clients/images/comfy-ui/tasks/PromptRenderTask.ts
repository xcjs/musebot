import { Client as DiscordClient, Message } from 'discord.js';
import { Logger } from 'meklog';

import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IPromptRenderTask } from '../../tasks/IPromptRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';

export class PromptRenderTask extends BaseTask implements IPromptRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #message: Message;

    #logger;

    override get taskChannel(): string {
        return `ComfyUi_${this.#comfyUiClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        message: Message) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;
        this.#message = message;

        this.#logger = new Logger(services.environmentSettings.isProduction, 'PromptRenderTask');
    }

    override async process(): Promise<void> {
        // const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        // const prompt = this.#message.content.replaceAll(botMention, '').trim();

        const renderData = await this.#comfyUiClient.render();
        await this.#comfyUiReplyService.reply(this.#message, renderData);
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
