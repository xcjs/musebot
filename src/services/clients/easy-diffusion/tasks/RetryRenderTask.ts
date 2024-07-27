import { ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { EasyDiffusionClient } from '../EasyDiffusionClient.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { ContentType } from '../../../../enums/ContentType.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { EasyDiffusionReplyService } from '../../discord/easyDiffusion/EasyDiffusionReplyService.js';

export class RetryRenderTask extends BaseTask {
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

        this.#logger = new Logger(environmentSettings.isProduction, 'RetryRenderTask');
    }

    override async process(): Promise<void> {
        this.taskStatus = TaskStatus.Busy;

        await this.#interaction.deferReply();

        const supportedContentTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const attachments = Array.from(this.#interaction.message.attachments, ([name, value]) => ({ name, value }));

        const imageAttachment = attachments.filter(attachment =>
            supportedContentTypes.includes(Object.values(ContentType)
                .find(contentTypeValue => contentTypeValue === attachment.value.contentType)))[0].value;

        let request: RenderRequest = null;

        if(imageAttachment?.description) {
            request = RenderRequest.FromJson(imageAttachment.description);
            request.refreshSeed();
        }

        const model = this.#environmentSettings.easyDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.easyDiffusionModels) :
            getRandomArrayEntry(await this.#easyDiffusionClient.getModels());

        this.#logger(LogLevel.Info, `Using ${model} as the selected EasyDiffusion model.`);

        const renderData = await this.#easyDiffusionReplyService.renderImage(request);
        await this.#easyDiffusionReplyService.reply(this.#interaction, renderData);

        this.taskStatus = TaskStatus.Successful;
    }
}
