import { AttachmentBuilder, ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from 'services/tasks/models/BaseTask.js';
import { TaskStatus } from 'services/tasks/enums/TaskStatus.js';
import { getRandomArrayEntry } from 'utilities/random-utilities.js';
import { OllamaClient } from 'services/clients/text/ollama/OllamaClient.js';
import { wrapText } from 'utilities/string-utilities.js';
import { MAX_FILE_NAME_LENGTH, MAX_TEXT_LINE_LENGTH } from 'enums/FileConstants.js';
import { BufferEncoding } from 'enums/BufferEncoding.js';
import { ReplyService } from 'services/clients/chat/discord/ReplyService.js';
import { Automatic1111Client } from 'services/clients/images/automatic1111/Automatic1111Client.js';
import { Automatic1111ReplyService } from 'services/clients/chat/discord/automatic1111/Automatic1111ReplyService.js';
import { Txt2ImgOptionsFactory } from 'services/clients/images/automatic1111/factories/Txt2ImgOptionsFactory.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings.js';

export class RandomRenderTask extends BaseTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #automatic1111Client: Automatic1111Client;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #replyService: ReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `Automatic1111_${this.#automatic1111Client.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#automatic1111Client = services.automatic1111Client;
        this.#automatic1111ReplyService = services.automatic1111ReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'RandomRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a RandomRenderTask.');

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#automatic1111Client.getModels()).title.split(' ')[0];

        this.#logger(LogLevel.Info, `Using ${model} as the selected image generation model.`);

        const ollamaClient = new OllamaClient(this.#services);
        const prompt = getRandomArrayEntry(this.#environmentSettings.stableDiffusionOllamaPrompts);
        const exchange = await ollamaClient.sendMessage(prompt, null);

        const request = Txt2ImgOptionsFactory.getCurrentModelSettings(model, exchange.response.response);
        const renderData = await this.#automatic1111ReplyService.renderImage(request, model);

        const content = `Two AIs whisper to each other over the the ancient \`TCP/IP\` protocol. They present ${this.#interaction.member} with this.`;

        const promptBuffer = Buffer.from(wrapText(request.prompt, MAX_TEXT_LINE_LENGTH).trim(),
            BufferEncoding.UTF8);

        const promptAttachment = new AttachmentBuilder(promptBuffer, {
            name: `${request.prompt.substring(0, MAX_FILE_NAME_LENGTH)}.md`
        });

        await this.#automatic1111ReplyService.reply(this.#interaction, renderData, content, [promptAttachment]);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
