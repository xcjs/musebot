import {AttachmentBuilder, BaseMessageOptions, ButtonInteraction, Client as DiscordClient } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings';
import { FeatureService } from '../../../features/FeatureService';
import { BaseTask } from '../../../tasks/models/BaseTask';
import { EasyDiffusionClient } from '../EasyDiffusionClient';
import { TaskStatus } from '../../../tasks/enums/TaskStatus';
import { ContentType } from '../../../../enums/ContentType';
import { RenderRequest } from '../models/requests/RenderRequest';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities';
import { BufferEncoding } from '../../../../enums/BufferEncoding';
import { IHttpExchangeWithAttachedResponse } from '../../../../models/IHttpExchangeWithAttachedResponse';
import { StatefulImageGenerationActionRow } from '../../discord/components/buttonRows/StatefulImageGenerationActionRow';
import { StatelessImageGenerationActionRow } from '../../discord/components/buttonRows/StatelessImageGenerationActionRow';
import { DiscordConstants } from '../../discord/enums/DiscordConstants';
import { IRenderResponse } from '../models/responses/IRenderResponse';
import { IStreamResponse } from '../models/responses/IStreamResponse';
import { MAX_FILE_NAME_LENGTH } from '../../../../enums/FileConstants';

export class RetryRenderTask extends BaseTask {
    #environmentSettings: EnvironmentSettings;
    #featureService: FeatureService;
    #discordClient: DiscordClient;
    #easyDiffusionClient: EasyDiffusionClient;

    #interaction: ButtonInteraction;

    #logger;

    constructor(
        environmentSettings: EnvironmentSettings,
        featureService: FeatureService,
        discordClient: DiscordClient,
        easyDiffusionClient: EasyDiffusionClient,
        interaction: ButtonInteraction) {
        super();

        this.#environmentSettings = environmentSettings;
        this.#featureService = featureService;
        this.#discordClient = discordClient;
        this.#easyDiffusionClient = easyDiffusionClient;
        this.#interaction = interaction;

        this.#logger = new Logger(environmentSettings.isProduction, 'PromptRenderTask');
    }

    override async process(): Promise<void> {
        this.taskStatus = TaskStatus.Busy;

        await this.#interaction.deferReply();

        const supportedContentTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ]

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

        const renderData = await this.#renderImage(request);

        await this.#reply(renderData);

        this.taskStatus = TaskStatus.Successful;
    }

    async #renderImage(request: RenderRequest): Promise<IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse>> {
        this.#logger(LogLevel.Info, `Render prompt: ${request.prompt}`);

        const renderExchange = await this.#easyDiffusionClient.render(request);

        if(renderExchange === null || renderExchange.response === null) {
            return Promise.reject('The render request failed.');
        }

        const streamResponse = await this.#easyDiffusionClient.stream(renderExchange);

        if(streamResponse === null) {
            return Promise.reject('The stream request failed.');
        }

        return {
            exchange: renderExchange,
            response: streamResponse
        };
    }

    async #reply(renderData: IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse> | null): Promise<void> {
        const renderRequest = renderData.exchange.request;
        const streamResponse = renderData.response;

        const fileName = this.#getFileNameFromPrompt(renderRequest);
        const jsonRequest = JSON.stringify(renderRequest);

        const files: Array<AttachmentBuilder> = [];

        const imageBuffer = Buffer.from(streamResponse.output[0].data.split(",")[1], BufferEncoding.Base64);

        const imageAttachment = new AttachmentBuilder(imageBuffer, {
            name: `${fileName}.${renderRequest.output_format}`
        });

        files.push(imageAttachment);

        const isStatefulResponse = jsonRequest.length <= DiscordConstants.ImageDescriptionMaxLength;

        this.#logger(LogLevel.Info, `Attaching render for "${renderRequest.prompt}": ${jsonRequest}`);

        const reply: BaseMessageOptions = {
            files,
            components: [isStatefulResponse ?
                new StatefulImageGenerationActionRow(this.#featureService).build() :
                new StatelessImageGenerationActionRow(this.#featureService).build()]
        };

        await this.#interaction.reply(reply);
    }

    #getFileNameFromPrompt(renderRequest: RenderRequest): string {
        return `${renderRequest.seed}_${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }
}
