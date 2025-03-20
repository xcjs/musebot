import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { OllamaClient } from '../../../text/ollama/OllamaClient.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IExpandPromptTask } from '../../tasks/IExpandPromptTask.js';
import { ComfyUiAttachRenderTask } from './ComfyUiAttachRenderTask.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiExpandPromptTask extends ComfyUiBaseTask implements IExpandPromptTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #ollamaClient: OllamaClient;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `Ollama_${this.#ollamaClient.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services, interaction);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#ollamaClient = services.ollamaClient;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiExpandPromptTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger(LogLevel.Info, 'Processing a ComfyUiExpandPromptTask...');

        const imageAttachments = this.#replyService.getImageAttachments(this.#interaction);

        if (imageAttachments.length == 0) {
            this.#logger(LogLevel.Warning, 'No attachments were found - exiting the task.');
            return;
        }

        const originalRequest = SerializableRenderRequest.fromJson(imageAttachments[0].description);

        const prompt = `The following is a prompt used to generate an image - expand it with meticulous detail so it can be rendered better: ${originalRequest.prompt}`;
        this.#logger(LogLevel.Info, `Calling Ollama with "${prompt}" to get an expanded prompt.`);
        const exchange = await this.#ollamaClient.sendMessage(prompt, null);
        this.#logger(LogLevel.Info, `Ollama responded with ${exchange.response.response}`);

        const content = `${this.#interaction.member} expanded the detail in the prompt: \`${originalRequest.prompt}\``;

        this.#taskQueue.add(new ComfyUiAttachRenderTask(
            this.#services,
            this.#interaction,
            { content },
            exchange.response.response,
        ));
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
