import { Txt2ImgOptions } from '@lancercomet/sd-api';
import { AttachmentBuilder, BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { FeatureService } from '../../../features/FeatureService.js';
import { MAX_FILE_NAME_LENGTH } from '../../../../enums/FileConstants.js';
import { Automatic1111Client } from '../../automatic1111/Automatic1111Client.js';
import { IHttpExchangeWithAttachedData } from '../../../../models/IHttpExchangeWithAttachedData.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';
import { SerializableRenderRequest } from '../../automatic1111/models/SerializableRenderRequest.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';
import { StatefulImageGenerationActionRows } from '../components/buttonRows/StatefulImageGenerationActionRows.js';
import { StatelessImageGenerationActionRow } from '../components/buttonRows/StatelessImageGenerationActionRow.js';

export class Automatic1111ReplyService {
    #environmentSettings: EnvironmentSettings;
    #automatic1111Client: Automatic1111Client;
    #featureService: FeatureService;

    #logger;

    get easyDiffusionHost() {
        return this.#automatic1111Client.host;
    }

    constructor(environmentSettings: EnvironmentSettings, featureService: FeatureService, automatic1111Client: Automatic1111Client) {
        this.#environmentSettings = environmentSettings;
        this.#featureService = featureService;
        this.#automatic1111Client = automatic1111Client;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'Automatic1111ReplyService');
    }

    async reply(interaction: Message | ButtonInteraction,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderData: IHttpExchangeWithAttachedData<Txt2ImgOptions, any, string>,
        model: string,
        content: string | null = null,
        additionalAttachments: Array<AttachmentBuilder> | null = null,
        isEdit: boolean = false): Promise<void> {
        const renderRequest = renderData.exchange.request;
        const renderResponse = renderData.exchange.response;

        const fileName = this.getFileNameFromPrompt(renderRequest);

        const jsonRequest = SerializableRenderRequest.fromTxt2ImgOptionsUpdated(renderRequest, model).toString();

        const isStatefulResponse = jsonRequest.length <= DiscordConstants.ImageDescriptionMaxLength;

        const imageBuffer = Buffer.from(renderResponse.images[0], BufferEncoding.Base64)

        this.#logger(LogLevel.Info, `Attaching render for "${renderRequest.prompt}": ${jsonRequest}`);

        const imageAttachment = new AttachmentBuilder(imageBuffer, {
            name: `${fileName}.png`,
            description: isStatefulResponse ? jsonRequest : null
        });

        let files: Array<AttachmentBuilder> = [imageAttachment];

        if(additionalAttachments) {
            files = files.concat(additionalAttachments);
        }

        const reply: BaseMessageOptions = {
            content,
            files,
            components: isStatefulResponse ?
                new StatefulImageGenerationActionRows(this.#environmentSettings, this.#featureService, renderRequest).build() :
                [new StatelessImageGenerationActionRow(this.#featureService).build()]
        };

        if(interaction instanceof Message) {
            if(isEdit) {
                reply.components = interaction.components;
                await interaction.edit(reply);
            } else {
                await interaction.reply(reply);
            }
        } else if(interaction instanceof ButtonInteraction) {
            await interaction.editReply(reply);
        }

        await interaction.reply(reply);
    }

    getFileNameFromPrompt(renderRequest: Txt2ImgOptions): string {
        return `${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }
}
