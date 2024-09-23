import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { EasyDiffusionClient } from '../EasyDiffusionClient.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';
import { OllamaClient } from '../../ollama/OllamaClient.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { ContentType } from '../../../../enums/ContentType.js';
import { AttachRenderTask } from './AttachRenderTask.js';
import { TaskQueue } from '../../../tasks/services/TaskQueue.js';
import { MessageService } from '../../discord/services/MessageService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';

export class ExpandPromptTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;

    #ollamaClient: OllamaClient;
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #messageService: MessageService;
    #replyService: ReplyService;
    #taskQueue: TaskQueue;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `Ollama_${this.#ollamaClient.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#ollamaClient = services.ollamaClient;
        this.#easyDiffusionClient = services.easyDiffusionClient;
        this.#easyDiffusionReplyService = services.easyDiffusionReplyService;
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
        const originalRequest = RenderRequest.fromJson(imageAttachment.description);

        const prompt = `The following is a prompt used to generate an image - expand it with meticulous detail so it can be rendered better: ${originalRequest.prompt}`;
        this.#logger(LogLevel.Info, `Calling Ollama with "${prompt}" to get an expanded prompt.`);
        const exchange = await this.#ollamaClient.sendMessage(prompt, null);
        this.#logger(LogLevel.Info, `Ollama responded with ${exchange.response.response}`);

        const content = `${this.#interaction.member} expanded the detail in the prompt: \`${originalRequest.prompt}\``;

        this.#taskQueue.add(new AttachRenderTask(
            this.#environmentSettings,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            this.#replyService,
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
