import { AttachmentBuilder, BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IHttpExchangeWithAttachedResponse } from '../../../../models/IHttpExchangeWithAttachedResponse.js';
import { RenderRequest } from '../../easy-diffusion/models/requests/RenderRequest.js';
import { IRenderResponse } from '../../easy-diffusion/models/responses/IRenderResponse.js';
import { IStreamResponse } from '../../easy-diffusion/models/responses/IStreamResponse.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { StatefulImageGenerationActionRow } from '../components/buttonRows/StatefulImageGenerationActionRow.js';
import { StatelessImageGenerationActionRow } from '../components/buttonRows/StatelessImageGenerationActionRow.js';
import { FeatureService } from '../../../features/FeatureService.js';
import { MAX_FILE_NAME_LENGTH } from '../../../../enums/FileConstants.js';
import { EasyDiffusionClient } from '../../easy-diffusion/EasyDiffusionClient.js';

export class EasyDiffusionReplyService {
    #easyDiffusionClient: EasyDiffusionClient;
    #featureService: FeatureService;

    #logger;

    constructor(environmentSettings: EnvironmentSettings, easyDiffusionClient: EasyDiffusionClient, featureService: FeatureService) {
        this.#easyDiffusionClient = easyDiffusionClient;
        this.#featureService = featureService;

        this.#logger = new Logger(environmentSettings.isProduction, 'EasyDiffusionReplyService');
    }

    async renderImage(request: RenderRequest): Promise<IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse>> {
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

    async reply(interaction: Message | ButtonInteraction, renderData: IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse>): Promise<void> {
        const renderRequest = renderData.exchange.request;
        const streamResponse = renderData.response;

        const fileName = this.#getFileNameFromPrompt(renderRequest);
        const jsonRequest = JSON.stringify(renderRequest);
        const isStatefulResponse = jsonRequest.length <= DiscordConstants.ImageDescriptionMaxLength;

        const files: Array<AttachmentBuilder> = [];

        const imageBuffer = Buffer.from(streamResponse.output[0].data.split(",")[1], BufferEncoding.Base64);

        const imageAttachment = new AttachmentBuilder(imageBuffer, {
            name: `${fileName}.${renderRequest.output_format}`,
            description: isStatefulResponse ? jsonRequest : null
        });

        files.push(imageAttachment);

        this.#logger(LogLevel.Info, `Attaching render for "${renderRequest.prompt}": ${jsonRequest}`);

        const reply: BaseMessageOptions = {
            files,
            components: [isStatefulResponse ?
                new StatefulImageGenerationActionRow(this.#featureService).build() :
                new StatelessImageGenerationActionRow(this.#featureService).build()]
        };

        if(interaction instanceof Message) {
            await interaction.reply(reply);
        } else if(interaction instanceof ButtonInteraction) {
            await interaction.editReply(reply);
        }
    }

    #getFileNameFromPrompt(renderRequest: RenderRequest): string {
        return `${renderRequest.seed}_${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }
}
