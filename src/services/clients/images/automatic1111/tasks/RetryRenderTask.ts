import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { ContentType } from '../../../../../enums/ContentType.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { Automatic1111ReplyService } from '../../../chat/discord/automatic1111/Automatic1111ReplyService.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { ReplyService } from '../../../chat/discord/replies/ReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { Automatic1111Client } from '../Automatic1111Client.js';
import { Txt2ImgOptionsRequest } from '../models/requests/Txt2ImgOptionsRequest.js';

export class RetryRenderTask extends BaseTask {
    #environmentSettings: IEnvironmentSettings;
    #automatic1111Client: Automatic1111Client;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #replyService: ReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `Automatic1111_${this.#automatic1111Client.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: ButtonInteraction) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#automatic1111Client = services.automatic1111Client;
        this.#automatic1111ReplyService = services.automatic1111ReplyService;
        this.#replyService = services.replyService;
        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'RetryRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a RetryRenderTask.');

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#replyService.getAttachmentsByType(this.#interaction, imageTypes)[0];

        let request: Txt2ImgOptionsRequest = null;

        if(imageAttachment?.description) {
            request = SerializableRenderRequest.fromJson(imageAttachment.description).toTxt2ImgOptionsRequest();
            request.seed = -1;
        }

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#automatic1111Client.getModels()).title.split(' ')[0];

        this.#logger(LogLevel.Info, `Using ${model} as the selected image generation model.`);

        const renderData = await this.#automatic1111Client.render(request, model);
        const content = `${this.#interaction.member} re-rendered \`${request.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);

        await this.#automatic1111ReplyService.reply(this.#interaction, renderData, content);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
