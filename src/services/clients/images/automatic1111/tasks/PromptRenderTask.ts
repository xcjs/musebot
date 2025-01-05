import { Client as DiscordClient, Message, MessageType } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { Automatic1111ReplyService } from '../../../chat/discord/automatic1111/Automatic1111ReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IPromptRenderTask } from '../../tasks/IPromptRenderTask.js';
import { Automatic1111Client } from '../Automatic1111Client.js';
import { Txt2ImgOptionsFactory } from '../factories/Txt2ImgOptionsFactory.js';
import { JsonRenderTask } from './JsonRenderTask.js';

export class PromptRenderTask extends BaseTask implements IPromptRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #automatic1111Client: Automatic1111Client;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #message: Message;

    #logger;

    override get taskChannel(): string {
        return `Automatic1111_${this.#automatic1111Client.host}`;
    }

    constructor(
        services: IServiceContainer,
        message: Message) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#automatic1111Client = services.automatic1111Client;
        this.#automatic1111ReplyService = services.automatic1111ReplyService;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;
        this.#message = message;

        this.#logger = new Logger(services.environmentSettings.isProduction, 'PromptRenderTask');
    }

    override async process(): Promise<void> {
        const prompt = this.#message.type === MessageType.Reply
            ? `${((await this.#getAllAntecedentPrompts()).join(' '))} ${this.#message.content}`.trim()
            : this.#filterBotMentions(this.#message.content).trim();

        console.log(LogLevel.Info, `Preparing to render an image for the prompt: ${prompt}`);

        if(prompt.charAt(0) === '{') {
            this.#taskQueue.add(new JsonRenderTask(
                this.#services,
                this.#message));
            return;
        }

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#automatic1111Client.getModels()).title.split(' ')[0];

        this.#logger(LogLevel.Info, `Using ${model} as the selected Automatic1111 model.`);

        const request = Txt2ImgOptionsFactory.getCurrentModelSettings(model, prompt);

        const renderData = await this.#automatic1111Client.render(request, model);
        await this.#automatic1111ReplyService.reply(this.#message, renderData);
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#message);
        }
    }

    #filterBotMentions(messageContent: string | null): string {
        if (messageContent === null) {
            return '';
        }

        const botMention = this.#message.mentions.members.find(x => x.id === this.#discordClient.user?.id)?.toString() || '';
        return messageContent.replaceAll(botMention, '').trim();
    }

    async #getAllAntecedentPrompts(): Promise<Array<string>> {
        const prompts: Array<string> = [];
        let currentMessage = this.#message;

        while(currentMessage.reference !== null) {
            const antecedentMessage = await currentMessage.fetchReference();

            if(antecedentMessage.content !== null && antecedentMessage.content.length > 0) {
                prompts.push(this.#filterBotMentions(antecedentMessage.content.trim()));
            }

            currentMessage = antecedentMessage;
        }

        return prompts.reverse();
    }
}
