import { AttachmentBuilder, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';
import { DiscordConstants } from '../../discord/enums/DiscordConstants.js';
import { splitText } from '../../../../utilities/string-utilities.js';
import { IHttpExchangeWithAttachedResponse } from '../../../../models/IHttpExchangeWithAttachedResponse.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';
import { RenderRequest } from '../../easy-diffusion/models/requests/RenderRequest.js';
import { IRenderResponse } from '../../easy-diffusion/models/responses/IRenderResponse.js';
import { IStreamResponse } from '../../easy-diffusion/models/responses/IStreamResponse.js';
import { LargeLanguageModelRow } from '../../discord/components/buttonRows/LargeLanguageModelRow.js';
import { FeatureService } from '../../../features/FeatureService.js';

export class OllamaStreamingReplyService {
    #environmentSettings: EnvironmentSettings;
    #featureService: FeatureService;
    #easyDiffusionReplyService: EasyDiffusionReplyService

    #logger;

    #replies: Array<Message> = [];

    constructor(
        environmentSettings: EnvironmentSettings,
        featureService: FeatureService,
        easyDiffusionReplyService: EasyDiffusionReplyService) {
        this.#environmentSettings = environmentSettings;
        this.#featureService = featureService;
        this.#easyDiffusionReplyService = easyDiffusionReplyService;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'OllamaStreamingReplyService');
    }

    async reply(message: Message, responseBatch: string): Promise<void> {
        if(this.#currentReply() == null && responseBatch.length <= DiscordConstants.ContentMaxLength) {
            this.#replies.push(await message.reply(responseBatch));
        } else if(this.#currentReply().content.length + responseBatch.length <= DiscordConstants.ContentMaxLength) {
            await this.#currentReply().edit(`${this.#currentReply().content}${responseBatch}`);
        }
        else {
            const responseBatches = splitText(responseBatch, DiscordConstants.ContentMaxLength);

            responseBatches.forEach(async (response) => {
                this.#replies.push(await message.reply(response));
            });
        }
    }

    async addComponents(): Promise<void> {
        const lastReply = this.#currentReply();

        await lastReply.edit({
            content: lastReply.content,
            components: [new LargeLanguageModelRow(this.#featureService).build()]
        })
    }

    async attachImage(renderData: IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse>): Promise<void> {
        this.#logger(LogLevel.Info, 'Attached render to last Discord Ollama reply.');

        const streamResponse = renderData.response;
        const renderRequest = renderData.exchange.request;
        const imageBuffer = Buffer.from(streamResponse.output[0].data.split(",")[1], BufferEncoding.Base64);

        const files: Array<AttachmentBuilder> = [];

        const lastReply = this.#replies[this.#replies.length - 1];

        files.push(new AttachmentBuilder(imageBuffer, {
            name: `${this.#easyDiffusionReplyService.getFileNameFromPrompt(renderRequest)}.${renderRequest.output_format}`
        }));

        await lastReply.edit({
            content: lastReply.content,
            files,
            components: lastReply.components
        });
    }

    clearState() {
        this.#replies = [];
    }

    #currentReply(): Message | null {
        if(this.#replies.length === 0) {
            return null;
        }

        return this.#replies[this.#replies.length - 1];
    }
}
