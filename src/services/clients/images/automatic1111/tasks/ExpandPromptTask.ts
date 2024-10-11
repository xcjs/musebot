import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from 'services/tasks/models/BaseTask.js';
import { TaskStatus } from 'services/tasks/enums/TaskStatus.js';
import { OllamaClient } from 'services/clients/text/ollama/OllamaClient.js';
import { ReplyService } from 'services/clients/chat/discord/ReplyService.js';
import { ContentType } from 'enums/ContentType.js';
import { TaskQueue } from 'services/tasks/TaskQueue.js';
import { MessageService } from 'services/clients/chat/discord/MessageService.js';
import { SerializableRenderRequest } from 'services/clients/images/stable-diffusion/models/SerializableRenderRequest.js';
import { AttachRenderTask } from 'services/clients/images/automatic1111/tasks/AttachRenderTask.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings.js';

export class ExpandPromptTask extends BaseTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #ollamaClient: OllamaClient;
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
        this.#messageService = services.messageService;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ExpandPromptTask');
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
            this.#interaction,
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
