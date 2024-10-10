import { ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { Automatic1111ReplyService } from '../../discord/automatic1111/Automatic1111ReplyService.js';
import { Automatic1111Client } from '../Automatic1111Client.js';
import { Txt2ImgOptionsFactory } from '../factories/Txt2ImgOptionsFactory.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';

export class AttachRenderTask extends BaseTask {
    #environmentSettings: IEnvironmentSettings;
    #automatic1111Client: Automatic1111Client;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #replyService: ReplyService;
    #prompt: string;
    #content: string | null;
    #isEdit: boolean;

    #interaction: Message | ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `Automatic1111_${this.#automatic1111Client.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        prompt: string,
        content: string | null = null,
        isEdit: boolean = false) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#automatic1111Client = services.automatic1111Client;
        this.#automatic1111ReplyService = services.automatic1111ReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;
        this.#prompt = prompt;
        this.#content = content;
        this.#isEdit = isEdit;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'AttachRenderTask');
    }

    override async process(): Promise<void> {
        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#automatic1111Client.getModels()).title.split(' ')[0];

        this.#logger(LogLevel.Info, `Using ${model} as the selected image generation model.`);

        const request = Txt2ImgOptionsFactory.getCurrentModelSettings(model, this.#prompt)
        const renderData = await this.#automatic1111ReplyService.renderImage(request, model);

        if(this.#interaction instanceof ButtonInteraction || this.#isEdit) {
            await this.#automatic1111ReplyService.reply(this.#interaction, renderData, this.#content, null, true);
        } else {
            await this.#automatic1111ReplyService.reply(this.#interaction, renderData, this.#content);
        }
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
