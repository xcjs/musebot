import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { OllamaClient } from '../../ollama/OllamaClient.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { ContentType } from '../../../../enums/ContentType.js';
import { TaskQueue } from '../../../tasks/services/TaskQueue.js';
import { MessageService } from '../../discord/services/MessageService.js';
import { Automatic1111Client } from '../Automatic1111Client.js';
import { Automatic1111ReplyService } from '../../discord/automatic1111/Automatic1111ReplyService.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { AttachRenderTask } from './AttachRenderTask.js';
import { IServiceContainer } from '../../../IServiceContainer.js';

export class ExpandPromptTask extends BaseTask {
    #services: IServiceContainer;

    #environmentSettings: EnvironmentSettings;
    #ollamaClient: OllamaClient;
    #automatic1111Client: Automatic1111Client;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #messageService: MessageService;
    #replyService: ReplyService;
    #taskQueue: TaskQueue;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `Ollama_${this.#ollamaClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: ButtonInteraction) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#ollamaClient = services.ollamaClient;
        this.#automatic1111Client = services.automatic1111Client;
        this.#automatic1111ReplyService = services.automatic1111ReplyService;
        this.#messageService = services.messageService;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#interaction = interaction;

        this.#logger = new Logger(services.environmentSettings.isProduction, 'ExpandPromptTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a ExpandPromptTask.');

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#messageService.getAttachmentsByType(this.#interaction, imageTypes)[0];
        const originalRequest = SerializableRenderRequest.fromJson(imageAttachment.description);

        const prompt = `The following is a prompt used to generate an image - expand it with meticulous detail so it can be rendered better: ${originalRequest.prompt}`;
        this.#logger(LogLevel.Info, `Calling Ollama with "${prompt}" to get an expanded prompt.`);
        const exchange = await this.#ollamaClient.sendMessage(prompt, null);
        this.#logger(LogLevel.Info, `Ollama responded with ${exchange.response.response}`);

        const content = `${this.#interaction.member} expanded the detail in the prompt: \`${originalRequest.prompt}\``;

        this.#taskQueue.add(new AttachRenderTask(
            this.#services,
            exchange.response.response,
            content
        ));
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
