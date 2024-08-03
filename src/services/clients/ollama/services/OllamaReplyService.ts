import { AttachmentBuilder, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';
import { GenerateRequest, GenerateResponse } from 'ollama';

import { IHttpExchange } from '../../../../models/IHttpExchange.js';
import { splitText } from '../../../../utilities/string-utilities.js';
import { DiscordConstants } from '../../discord/enums/DiscordConstants.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { IStreamResponse } from '../../easy-diffusion/models/responses/IStreamResponse.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';
import { EasyDiffusionReplyService } from '../../discord/easy-diffusion/EasyDiffusionReplyService.js';
import { IHttpExchangeWithAttachedResponse } from '../../../../models/IHttpExchangeWithAttachedResponse.js';
import { RenderRequest } from '../../easy-diffusion/models/requests/RenderRequest.js';
import { IRenderResponse } from '../../easy-diffusion/models/responses/IRenderResponse.js';

export class OllamaReplyService {
    #environmentSettings: EnvironmentSettings;
    #easyDiffusionReplyService: EasyDiffusionReplyService;

    #logger;

    #replies: Array<Message> = [];

    constructor(
        environmentSettings: EnvironmentSettings,
        easyDiffusionReplyService: EasyDiffusionReplyService) {
        this.#environmentSettings = environmentSettings;
        this.#easyDiffusionReplyService = easyDiffusionReplyService;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'OllamaReplyService');
    }

    async reply(message: Message, exchange: IHttpExchange<GenerateRequest, GenerateResponse>): Promise<void> {
        const responses = splitText(exchange.response.response, DiscordConstants.ContentMaxLength);

        responses.forEach(async (response) => {
            this.#replies.push(await message.reply(response));
        });
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
