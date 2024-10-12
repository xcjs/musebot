import { ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { EasyDiffusionReplyService } from '../../../chat/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { ReplyService } from '../../../chat/discord/replies/ReplyService.js';
import { EasyDiffusionClient } from '../EasyDiffusionClient.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';

export class AttachRenderTask extends BaseTask {
    #environmentSettings: IEnvironmentSettings;
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #replyService: ReplyService;

    #prompt: string;
    #content: string | null;
    #isEdit: boolean;

    #interaction: Message | ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `EasyDiffusion_${this.#easyDiffusionClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        prompt: string,
        content: string | null = null,
        isEdit: boolean = false) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#easyDiffusionClient = services.easyDiffusionClient;
        this.#easyDiffusionReplyService = services.easyDiffusionReplyService;
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
            getRandomArrayEntry(await this.#easyDiffusionClient.getModels());

        this.#logger(LogLevel.Info, `Using ${model} as the selected EasyDiffusion model.`);

        const request = new RenderRequest(model, this.#prompt);

        const renderData = await this.#easyDiffusionReplyService.renderImage(request);

        if(this.#interaction instanceof ButtonInteraction || this.#isEdit) {
            await this.#easyDiffusionReplyService.reply(this.#interaction, renderData, this.#content, null, true);
        } else {
            await this.#easyDiffusionReplyService.reply(this.#interaction, renderData, this.#content);
        }
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
