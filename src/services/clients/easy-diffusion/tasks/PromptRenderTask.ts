import { AttachmentBuilder, BaseMessageOptions, Client as DiscordClient, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { EasyDiffusionClient } from '../EasyDiffusionClient.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';
import { IHttpExchangeWithAttachedResponse } from '../../../../models/IHttpExchangeWithAttachedResponse.js';
import { IRenderResponse } from '../models/responses/IRenderResponse.js';
import { IStreamResponse } from '../models/responses/IStreamResponse.js';
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { MAX_FILE_NAME_LENGTH } from '../../../../enums/FileConstants.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';

export class PromptRenderTask extends BaseTask {
    #request: RenderRequest;
    #easyDiffusionClient: EasyDiffusionClient;
    #message: Message;

    #logger;

    constructor(environmentSettings: EnvironmentSettings, discordClient: DiscordClient, message: Message, model: string | null) {
        super();

        this.#easyDiffusionClient = new EasyDiffusionClient(environmentSettings);
        this.#message = message;

        const botMention = message.mentions.members.find(x => x.id === discordClient.user?.id)?.toString() || '';
        const prompt = message.content.replaceAll(botMention, '');
        this.#request = new RenderRequest(model, prompt);

        this.#logger = new Logger(environmentSettings.isProduction, 'PromptRenderTask');
    }

    override async process(): Promise<void> {
        this.taskStatus = TaskStatus.Busy;

        const renderData = await this.#renderImage();
        await this.#reply(renderData);

        this.taskStatus = TaskStatus.Successful;
    }

    async #renderImage(): Promise<IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse>> {
        this.#logger(LogLevel.Info, `Render prompt: ${this.#request.prompt}`);

        const renderExchange = await this.#easyDiffusionClient.render(this.#request);

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

        this.#logger(LogLevel.Info, `Attaching render for "${renderRequest.prompt}": ${jsonRequest}`);

        const reply: BaseMessageOptions = {
            files
        };

        await this.#message.reply(reply);
    }

    #getFileNameFromPrompt(renderRequest: RenderRequest): string {
        return `${renderRequest.seed}_${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }
}
