import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { ContentType } from '../../../../enums/ContentType.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';
import { EasyDiffusionClient } from '../EasyDiffusionClient.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';

export class DecreaseGuidanceScaleRenderTask extends BaseTask {
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

        this.#logger = new Logger(environmentSettings.isProduction, 'DecreaseGuidanceScaleRenderTask');
    }

    override async process(): Promise<void> {
        this.taskStatus = TaskStatus.Busy;

        this.#logger(LogLevel.Info, 'Processing a DecreaseGuidanceScaleRenderTask.');

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#easyDiffusionReplyService.getAttachmentsByType(this.#interaction, imageTypes)[0];

        let request: RenderRequest = null;

        if(imageAttachment?.description) {
            request = RenderRequest.FromJson(imageAttachment.description);
            request.guidance_scale -= this.#environmentSettings.easyDiffusionGuidanceScaleInterval;
        }

        const model = this.#environmentSettings.easyDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.easyDiffusionModels) :
            getRandomArrayEntry(await this.#easyDiffusionClient.getModels());

        this.#logger(LogLevel.Info, `Using ${model} as the selected EasyDiffusion model.`);

        const renderData = await this.#easyDiffusionReplyService.renderImage(request);
        const content = `The guidance scale was decreased from ${request.guidance_scale
            + this.#environmentSettings.easyDiffusionGuidanceScaleInterval} to ${request.guidance_scale} by ${this.#interaction.member}.`;

        await this.#easyDiffusionReplyService.reply(this.#interaction, renderData, content, null);

        this.taskStatus = TaskStatus.Successful;
    }
}
