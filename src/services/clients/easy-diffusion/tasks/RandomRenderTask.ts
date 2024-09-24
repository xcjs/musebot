import { AttachmentBuilder, ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { EasyDiffusionClient } from '../EasyDiffusionClient.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';
import { OllamaClient } from '../../ollama/OllamaClient.js';
import { wrapText } from '../../../../utilities/string-utilities.js';
import { MAX_FILE_NAME_LENGTH, MAX_TEXT_LINE_LENGTH } from '../../../../enums/FileConstants.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';

export class RandomRenderTask extends BaseTask {
    #services: IServiceContainer;

    #environmentSettings: EnvironmentSettings;
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #replyService: ReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `EasyDiffusion_${this.#easyDiffusionClient.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#easyDiffusionClient = services.easyDiffusionClient;
        this.#easyDiffusionReplyService = services.easyDiffusionReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'RandomRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a RandomRenderTask.');

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#easyDiffusionClient.getModels());

        this.#logger(LogLevel.Info, `Using ${model} as the selected EasyDiffusion model.`);

        const ollamaClient = new OllamaClient(this.#services);
        const prompt = getRandomArrayEntry(this.#environmentSettings.stableDiffusionOllamaPrompts);
        const exchange = await ollamaClient.sendMessage(prompt, null);

        const request = new RenderRequest(model, exchange.response.response);
        const renderData = await this.#easyDiffusionReplyService.renderImage(request);

        const content = `Two AIs whisper to each other over the the ancient \`TCP/IP\` protocol. They present ${this.#interaction.member} with this.`;

        const promptBuffer = Buffer.from(wrapText(request.prompt, MAX_TEXT_LINE_LENGTH).trim(),
            BufferEncoding.UTF8);

        const promptAttachment = new AttachmentBuilder(promptBuffer, {
            name: `${request.prompt.substring(0, MAX_FILE_NAME_LENGTH)}.md`
        });

        await this.#easyDiffusionReplyService.reply(this.#interaction, renderData, content, [promptAttachment]);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
