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

export class OllamaStreamingReplyService {
    #environmentSettings: EnvironmentSettings;
    #easyDiffusionReplyService: EasyDiffusionReplyService

    #logger;

    #replies: Array<Message> = [];

    constructor(
        environmentSettings: EnvironmentSettings,
        easyDiffusionReplyService: EasyDiffusionReplyService) {
        this.#environmentSettings = environmentSettings;
        this.#easyDiffusionReplyService = easyDiffusionReplyService;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'OllamaStreamingReplyService');
    }

    async reply(message: Message, responseBatch: string): Promise<void> {
        let reply: Message;

        if(reply.content.length + responseBatch.length <= DiscordConstants.ContentMaxLength) {
            reply = await message.reply(responseBatch);
        } else if(responseBatch.length > DiscordConstants.ContentMaxLength) {
            const responseBatches = splitText(responseBatch, DiscordConstants.ContentMaxLength);

            responseBatches.forEach(async (response) => {
                this.#replies.push(await message.reply(response));
            });
        }
        else {
            await reply.edit(`${reply.content}${responseBatch}`);
        }
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
            files: files
        });
    }
}
