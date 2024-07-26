import { AttachmentBuilder, ButtonInteraction, Events, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../EnvironmentSettings.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';
import { DiscordPresenceStatus } from './enums/DiscordPresenceStatus.js';
import { OllamaClient } from '../ollama/OllamaClient.js';
import { DiscordConstants } from './enums/DiscordConstants.js';
import { splitText } from '../../../utilities/string-utilities.js';
import { EasyDiffusionClient } from '../easy-diffusion/EasyDiffusionClient.js';
import { BufferEncoding } from '../../../enums/BufferEncoding.js';
import { RenderRequest } from '../easy-diffusion/models/requests/RenderRequest.js';
import { MAX_FILE_NAME_LENGTH } from '../../../enums/FileConstants.js';
import { SupportedFeature } from '../../features/enum/SupportedFeature.js';
import { TaskQueue } from '../../tasks/services/TaskQueue.js';

export class DiscordOllamaClient extends BaseDiscordClient {
    ollamaClients: Array<OllamaClient> = [];
    easyDiffusionClients: Array<EasyDiffusionClient> = [];

    #context: Array<number> = [];

    constructor(environmentSettings: EnvironmentSettings, taskQueue: TaskQueue) {
        super(environmentSettings, taskQueue);

        this.environmentSettings = environmentSettings;

        this.logger = new Logger(this.environmentSettings.isProduction, 'DiscordOllamaClient');

        this.#registerEvents();
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.client.once(Events.ClientReady, (event) => this.#onClientReady.call(self, event));
        this.client.on(Events.MessageCreate, async (message) => await this.#onMessageCreate.call(self, message));
    }

    #onClientReady(): Promise<void> {
        if(this.client.user === null) {
            return;
        }

        this.logger(LogLevel.Info, 'Client is ready.');
        this.client.user.setPresence({ activities: [], status: DiscordPresenceStatus.Online });
    }

    async #onMessageCreate(message: Message): Promise<void> {
        this.logger(LogLevel.Info, `Discord message created. ${message.author.displayName} (${message.author.username}): "${message}"`);

        if(!this.replyService.shouldReply(message)) {
            this.logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.logger(LogLevel.Info, 'Replying to message...');

        if(this.environmentSettings.ollamaStreamsResponse) {
            await this.#replyWithStream(message);
        } else {
            await this.#reply(message);
        }
    }

    async #reply(message: Message): Promise<void> {
        const ollamaClient = new OllamaClient(this.environmentSettings);
        this.ollamaClients.push(ollamaClient);

        const context = this.#context;

        const botMention = message.mentions.members.find(x => x.id === this.client.user?.id)?.toString() || '';

        const formattedMessage = `${message.author.displayName}: ${message.content.replaceAll(botMention, '')}`;

        const exchange = await ollamaClient.sendMessage(formattedMessage, context);

        if(exchange === null) {
            await this.#replyWithError(message);
            return;
        }

        const responses = splitText(exchange.response.response, DiscordConstants.ContentMaxLength);

        responses.forEach(async (response, i) => {
            const reply = await message.reply(response);

            if(i === responses.length - 1 && this.featureService.hasFeature(SupportedFeature.ImagesAttachedToText)) {
                await this.#attachImage(reply, exchange.response.response);
            }
        });

        this.#context = exchange.response.context;
    }

    async #replyWithStream(message: Message): Promise<void> {
        const ollamaClient = new OllamaClient(this.environmentSettings);
        this.ollamaClients.push(ollamaClient);

        const context = this.#context;

        const botMention = message.mentions.members.find(x => x.id === this.client.user?.id)?.toString() || '';

        const formattedMessage = `${message.author.displayName}: ${message.content.replaceAll(botMention, '')}`;

        const exchange = await ollamaClient.sendMessageAndGetStream(formattedMessage, context);
        //const responses = splitText(exchange.response.response, DiscordConstants.ContentMaxLength);

        if(exchange === null) {
            await this.#replyWithError(message);
            return;
        }

        let reply: Message<boolean> | null = null;
        let startTime = performance.now();
        let fullResponse = '';
        let responseBatch = '';

        for await (const response of exchange.response) {
            console.log(`Appending "${response.response}"`);
            responseBatch += response.response;

            if(performance.now() - startTime >= 1000 / DiscordConstants.MaxRequestsPerSecond || response.done) {
                console.log('Flushing response batch.');

                if(reply === null || reply.content.length + responseBatch.length > DiscordConstants.ContentMaxLength) {
                    reply = await message.reply(responseBatch);
                } else if(responseBatch.length > DiscordConstants.ContentMaxLength) {
                    const responseBatches = splitText(responseBatch, DiscordConstants.ContentMaxLength);

                    responseBatches.forEach(async (response) => {
                        await message.reply(response);
                    });
                }
                else {
                    await reply.edit(`${reply.content}${responseBatch}`);
                }

                fullResponse += responseBatch;
                responseBatch = '';

                startTime = performance.now();
            }

            if(response.done) {
                this.#context = response.context;
            }
        }

        if(this.featureService.hasFeature(SupportedFeature.ImagesAttachedToText)) {
            await this.#attachImage(reply, fullResponse);
        }
    }

    async #attachImage(message: Message, imagePrompt: string): Promise<void> {
        const easyDiffusionClient = new EasyDiffusionClient(this.environmentSettings);
        this.easyDiffusionClients.push(easyDiffusionClient);

        this.logger(LogLevel.Info, `Image render prompt: ${imagePrompt}`);

        const renderExchange = await easyDiffusionClient.render(imagePrompt);

        if(renderExchange === null || renderExchange.response === null) {
            return;
        }

        const streamResponse = await easyDiffusionClient.stream(renderExchange);

        if(streamResponse === null) {
            return;
        }

        const renderRequest = renderExchange.request;

        const files: Array<AttachmentBuilder> = [];
        const imageBuffer = Buffer.from(streamResponse.output[0].data.split(",")[1], BufferEncoding.Base64);

        files.push(new AttachmentBuilder(imageBuffer, {
            name: `${this.#getFileNameFromPrompt(renderRequest)}.${renderRequest.output_format}`
        }));

        await message.edit({
            content: message.content,
            files: files
        });
    }

    #getFileNameFromPrompt(renderRequest: RenderRequest): string {
        return `${renderRequest.seed}_${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }

    async #replyWithError(message: Message | ButtonInteraction): Promise<void> {
        await message.reply({ content: this.environmentSettings.errorMessage });
    }
}
