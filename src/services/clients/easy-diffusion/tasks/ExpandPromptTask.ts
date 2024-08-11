import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { EasyDiffusionClient } from '../EasyDiffusionClient.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';
import { OllamaClient } from '../../ollama/OllamaClient.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { ContentType } from '../../../../enums/ContentType.js';

export class ExpandPromptTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #replyService: ReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `EasyDiffusion_${this.#easyDiffusionClient.host}`;
    }

    constructor(
        environmentSettings: EnvironmentSettings,
        easyDiffusionClient: EasyDiffusionClient,
        easyDiffusionReplyService: EasyDiffusionReplyService,
        replyService: ReplyService,
        interaction: ButtonInteraction) {
        super(environmentSettings.maxTaskAttempts);

        this.#environmentSettings = environmentSettings;
        this.#easyDiffusionClient = easyDiffusionClient;
        this.#easyDiffusionReplyService = easyDiffusionReplyService;
        this.#replyService = replyService;
        this.#interaction = interaction;

        this.#logger = new Logger(environmentSettings.isProduction, 'ExpandPromptTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a ExpandPromptTask.');

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#easyDiffusionReplyService.getAttachmentsByType(this.#interaction, imageTypes)[0];
        const originalRequest = RenderRequest.FromJson(imageAttachment.description);

        const ollamaClient = new OllamaClient(this.#environmentSettings);
        const prompt = `The following is a prompt used to generate an image - expand it with meticulous detail: ${originalRequest.prompt}`;
        this.#logger(LogLevel.Info, `Calling Ollama with "${prompt}" to get an expanded prompt.`);
        const exchange = await ollamaClient.sendMessage(prompt, null);
        this.#logger(LogLevel.Info, `Ollama responded with ${exchange.response.response}`);

        const model = this.#environmentSettings.easyDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.easyDiffusionModels) :
            getRandomArrayEntry(await this.#easyDiffusionClient.getModels());

        this.#logger(LogLevel.Info, `Using ${model} as the selected EasyDiffusion model.`);

        const request = new RenderRequest(model, exchange.response.response);
        const renderData = await this.#easyDiffusionReplyService.renderImage(request);

        const content = `${this.#interaction.member} asked for help to expand the detail in their prompt: \`${originalRequest.prompt}\``;

        await this.#easyDiffusionReplyService.reply(this.#interaction, renderData, content);
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Failed) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
