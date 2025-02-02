import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { Automatic1111ReplyService } from '../../../chat/discord/automatic1111/Automatic1111ReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IIncreaseGuidanceScaleRenderTask } from '../../tasks/IIncreaseGuidanceScaleRenderTask.js';
import { Automatic1111Client } from '../Automatic1111Client.js';
import { Txt2ImgOptionsRequest } from '../models/requests/Txt2ImgOptionsRequest.js';

export class IncreaseGuidanceScaleRenderTask extends BaseTask implements IIncreaseGuidanceScaleRenderTask {
    #environmentSettings: IEnvironmentSettings;
    #automatic1111Client: Automatic1111Client;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #replyService: IReplyService;

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
        this.#replyService = services.replyService;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'IncreaseGuidanceScaleRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing an IncreaseGuidanceScaleRenderTask.');

        const imageAttachment = this.#replyService.getImageAttachments(this.#interaction)[0];

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#automatic1111Client.getModels()).title.split(' ')[0];

        this.#logger(LogLevel.Info, `Using ${model} as the selected EasyDiffusion model.`);

        let request: Txt2ImgOptionsRequest = null;
        let cfgScaleValue = 0;

        if (imageAttachment?.description) {
            request = SerializableRenderRequest.fromJson(imageAttachment.description).toTxt2ImgOptionsRequest();

            if(model.toLocaleLowerCase().startsWith('flux')) {
                request.distilled_cfg_scale += this.#environmentSettings.stableDiffusionGuidanceScaleInterval;
                cfgScaleValue = request.distilled_cfg_scale;
            } else {
                request.cfg_scale += this.#environmentSettings.stableDiffusionGuidanceScaleInterval;
                cfgScaleValue = request.cfg_scale;
            }
        }

        const renderData = await this.#automatic1111Client.render(request, model);
        const content = `${this.#interaction.member} increased the guidance scale from ${cfgScaleValue
            - this.#environmentSettings.stableDiffusionGuidanceScaleInterval} to ${cfgScaleValue}.`;

        await this.#automatic1111ReplyService.reply(this.#interaction, renderData, content);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
