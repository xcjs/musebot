import { ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseTask } from 'services/tasks/models/BaseTask.js';
import { EasyDiffusionClient } from 'services/clients/images/easy-diffusion/EasyDiffusionClient.js';
import { RenderRequest } from 'services/clients/images/easy-diffusion/models/requests/RenderRequest.js';
import { TaskStatus } from 'services/tasks/enums/TaskStatus.js';
import { getRandomArrayEntry } from 'utilities/random-utilities.js';
import { EasyDiffusionReplyService } from 'services/clients/chat/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { ReplyService } from 'services/clients/chat/discord/ReplyService.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings.js';

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
