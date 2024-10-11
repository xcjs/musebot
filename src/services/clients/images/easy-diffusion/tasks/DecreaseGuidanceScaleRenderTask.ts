import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { ContentType } from 'enums/ContentType.js';
import { getRandomArrayEntry } from 'utilities/random-utilities.js';
import { TaskStatus } from 'services/tasks/enums/TaskStatus.js';
import { BaseTask } from 'services/tasks/models/BaseTask.js';
import { EasyDiffusionReplyService } from 'services/clients/chat/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { EasyDiffusionClient } from 'services/clients/images/easy-diffusion/EasyDiffusionClient.js';
import { RenderRequest } from 'services/clients/images/easy-diffusion/models/requests/RenderRequest.js';
import { ReplyService } from 'services/clients/chat/discord/ReplyService.js';
import { MessageService } from 'services/clients/chat/discord/MessageService.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings.js';

export class DecreaseGuidanceScaleRenderTask extends BaseTask {
    #environmentSettings: IEnvironmentSettings;
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #messageService: MessageService;
    #replyService: ReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `EasyDiffusion_${this.#easyDiffusionClient.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#easyDiffusionClient = services.easyDiffusionClient;
        this.#easyDiffusionReplyService = services.easyDiffusionReplyService;
        this.#messageService = services.messageService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'DecreaseGuidanceScaleRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a DecreaseGuidanceScaleRenderTask.');

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#messageService.getAttachmentsByType(this.#interaction, imageTypes)[0];

        let request: RenderRequest = null;

        if(imageAttachment?.description) {
            request = RenderRequest.fromJson(imageAttachment.description);
            request.guidance_scale -= this.#environmentSettings.stableDiffusionGuidanceScaleInterval;
        }

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#easyDiffusionClient.getModels());

        this.#logger(LogLevel.Info, `Using ${model} as the selected EasyDiffusion model.`);

        const renderData = await this.#easyDiffusionReplyService.renderImage(request);
        const content = `The guidance scale was decreased from ${request.guidance_scale
            + this.#environmentSettings.stableDiffusionGuidanceScaleInterval} to ${request.guidance_scale} by ${this.#interaction.member}.`;

        await this.#easyDiffusionReplyService.reply(this.#interaction, renderData, content);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
