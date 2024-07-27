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

export class RandomRenderTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #easyDiffusionClient: EasyDiffusionClient;

    #interaction: ButtonInteraction;

    #logger;

    constructor(
        environmentSettings: EnvironmentSettings,
        easyDiffusionClient: EasyDiffusionClient,
        easyDiffusionReplyService: EasyDiffusionReplyService,
        interaction: ButtonInteraction) {
        super();

        this.#environmentSettings = environmentSettings;
        this.#easyDiffusionClient = easyDiffusionClient;
        this.#easyDiffusionReplyService = easyDiffusionReplyService;
        this.#interaction = interaction;

        this.#logger = new Logger(environmentSettings.isProduction, 'RandomRenderTask');
    }

    override async process(): Promise<void> {
        this.taskStatus = TaskStatus.Busy;

        this.#logger(LogLevel.Info, 'Processing a RandomRenderTask.');

        const model = this.#environmentSettings.easyDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.easyDiffusionModels) :
            getRandomArrayEntry(await this.#easyDiffusionClient.getModels());

        this.#logger(LogLevel.Info, `Using ${model} as the selected EasyDiffusion model.`);

        const ollamaClient = new OllamaClient(this.#environmentSettings);
        const prompt = getRandomArrayEntry(this.#environmentSettings.easyDiffusionOllamaPrompts);
        const exchange = await ollamaClient.sendMessage(prompt, null);

        const request = new RenderRequest(model, exchange.response.response);
        const renderData = await this.#easyDiffusionReplyService.renderImage(request);

        const content = `Two AIs whisper to each other over the the ancient \`TCP/IP\` protocol. They present ${this.#interaction.member} with this.`;

        const promptBuffer = Buffer.from(wrapText(request.prompt, MAX_TEXT_LINE_LENGTH),
            BufferEncoding.UTF8);

        const promptAttachment = new AttachmentBuilder(promptBuffer, {
            name: `${request.prompt.substring(0, MAX_FILE_NAME_LENGTH)}.txt`
        });

        await this.#easyDiffusionReplyService.reply(this.#interaction, renderData, content, [promptAttachment]);

        this.taskStatus = TaskStatus.Successful;
    }
}
