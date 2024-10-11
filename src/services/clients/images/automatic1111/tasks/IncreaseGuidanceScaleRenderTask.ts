import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { ContentType } from 'enums/ContentType.js';
import { getRandomArrayEntry } from 'utilities/random-utilities.js';
import { TaskStatus } from 'services/tasks/enums/TaskStatus.js';
import { BaseTask } from 'services/tasks/models/BaseTask.js';
import { ReplyService } from 'services/clients/chat/discord/ReplyService.js';
import { MessageService } from 'services/clients/chat/discord/MessageService.js';
import { Automatic1111Client } from '../Automatic1111Client.js';
import { Automatic1111ReplyService } from 'services/clients/chat/discord/automatic1111/Automatic1111ReplyService.js';
import { SerializableRenderRequest } from 'services/clients/images/stable-diffusion/models/SerializableRenderRequest.js';
import { Txt2ImgOptionsRequest } from '../models/requests/Txt2ImgOptionsRequest.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings.js';

export class IncreaseGuidanceScaleRenderTask extends BaseTask {
    #environmentSettings: IEnvironmentSettings;
    #automatic1111Client: Automatic1111Client;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #messageService: MessageService;
    #replyService: ReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `Automatic1111_${this.#automatic1111Client.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#automatic1111Client = services.automatic1111Client;
        this.#automatic1111ReplyService = services.automatic1111ReplyService;
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

        let request: Txt2ImgOptionsRequest = null;

        if(imageAttachment?.description) {
            request = SerializableRenderRequest.fromJson(imageAttachment.description).toTxt2ImgOptionsRequest();
            request.distilled_cfg_scale += this.#environmentSettings.stableDiffusionGuidanceScaleInterval;
        }

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#automatic1111Client.getModels()).title.split(' ')[0];

        this.#logger(LogLevel.Info, `Using ${model} as the selected EasyDiffusion model.`);

        const renderData = await this.#automatic1111Client.render(request, model);
        const content = `The guidance scale was increased from ${request.distilled_cfg_scale
            - this.#environmentSettings.stableDiffusionGuidanceScaleInterval} to ${request.distilled_cfg_scale} by ${this.#interaction.member}.`;

        await this.#automatic1111ReplyService.reply(this.#interaction, renderData, content);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
