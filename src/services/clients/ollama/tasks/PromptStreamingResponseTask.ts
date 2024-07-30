import { Client as DiscordClient, Message } from 'discord.js';
import { Logger } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { ReplyService } from '../../discord/services/ReplyService.js';

export class PromptStreamingResponseTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;
    #discordClient: DiscordClient;
    #replyService: ReplyService;

    #message: Message;

    #logger;

    constructor(
        environmentSettings: EnvironmentSettings,
        discordClient: DiscordClient,
        message: Message) {
        super();

        this.#environmentSettings = environmentSettings;
        this.#discordClient = discordClient;
        this.#replyService
        this.#message = message;

        this.#logger = new Logger(environmentSettings.isProduction, 'PromptStreamingResponseTask');
    }

    override async process(): Promise<void> {
        this.taskStatus = TaskStatus.Busy;

        // const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        // const prompt = this.#message.content.replaceAll(botMention, '').trim();



        this.taskStatus = TaskStatus.Successful;
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Failed) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
