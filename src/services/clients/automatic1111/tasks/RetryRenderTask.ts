import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { Automatic1111Client } from '../Automatic1111Client.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { ContentType } from '../../../../enums/ContentType.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { DiscordConstants } from '../../discord/enums/DiscordConstants.js';
import { ReplyService } from '../../discord/services/ReplyService.js';
import { Automatic1111ReplyService } from '../../discord/automatic1111/Automatic1111ReplyService.js';
import { MessageService } from '../../discord/services/MessageService.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { Txt2ImgOptionsUpdated } from '../models/Txt2ImgOptionsUpdated.js';

export class RetryRenderTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;
    #automatic1111Client: Automatic1111Client;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #messageService: MessageService;
    #replyService: ReplyService;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `Automatic1111_${this.#automatic1111Client.host}`;
    }

    constructor(
        environmentSettings: EnvironmentSettings,
        automatic1111Client: Automatic1111Client,
        automatic1111ReplyService: Automatic1111ReplyService,
        messageService: MessageService,
        replyService: ReplyService,
        interaction: ButtonInteraction) {
        super(environmentSettings.maxTaskAttempts);

        this.#environmentSettings = environmentSettings;
        this.#automatic1111Client = automatic1111Client;
        this.#automatic1111ReplyService = automatic1111ReplyService;
        this.#messageService = messageService;
        this.#replyService = replyService;
        this.#interaction = interaction;

        this.#logger = new Logger(environmentSettings.isProduction, 'RetryRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a RetryRenderTask.');

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#messageService.getAttachmentsByType(this.#interaction, imageTypes)[0];

        let request: Txt2ImgOptionsUpdated = null;

        if(imageAttachment?.description) {
            request = SerializableRenderRequest.fromJson(imageAttachment.description).toTxt2ImgOptionsUpdated();
            request.seed = -1;
        }

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#automatic1111Client.getModels()).model_name;

        this.#logger(LogLevel.Info, `Using ${model} as the selected image generation model.`);

        const renderData = await this.#automatic1111Client.render(request, model);
        const content = `${this.#interaction.member} re-rendered \`${request.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);

        await this.#automatic1111ReplyService.reply(this.#interaction, renderData, model, content);
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Failed) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
