import { ButtonInteraction, Message, User } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { ContentType } from '../../../../../enums/ContentType.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { Automatic1111ReplyService } from '../../../chat/discord/automatic1111/Automatic1111ReplyService.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IRetryRenderTask } from '../../tasks/IRetryRenderTask.js';
import { Automatic1111Client } from '../Automatic1111Client.js';
import { Txt2ImgOptionsRequest } from '../models/requests/Txt2ImgOptionsRequest.js';

export class RetryRenderTask extends BaseTask implements IRetryRenderTask {
    #environmentSettings: IEnvironmentSettings;
    #automatic1111Client: Automatic1111Client;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #replyService: IReplyService;

    #interaction: Message | ButtonInteraction;
    #promptExtension: string | null;
    #userOverride: User | null;

    #logger;

    override get taskChannel(): string {
        return `Automatic1111_${this.#automatic1111Client.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        promptExtension: string | null = null,
        userOverride: User | null = null) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#automatic1111Client = services.automatic1111Client;
        this.#automatic1111ReplyService = services.automatic1111ReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;
        this.#promptExtension = promptExtension;
        this.#userOverride = userOverride;

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
        let content: string;

        if(imageAttachment?.description) {
            request = SerializableRenderRequest.fromJson(imageAttachment.description).toTxt2ImgOptionsRequest();
            content =
                `${this.#userOverride.id ? this.#replyService.mention(this.#userOverride) : this.#interaction.member}`
                + ` re-rendered \`${request.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);

            if(this.#promptExtension !== null) {
                request.prompt += ` ${this.#promptExtension}`;
                content += ` as \`${request.prompt}\``;
            } else {
                request.seed = -1;
            }
        }

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#automatic1111Client.getModels()).title.split(' ')[0];

        this.#logger(LogLevel.Info, `Using ${model} as the selected image generation model.`);

        const renderData = await this.#automatic1111Client.render(request, model);

        await this.#automatic1111ReplyService.reply(this.#interaction, renderData, content);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
