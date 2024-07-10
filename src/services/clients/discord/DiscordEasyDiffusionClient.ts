import { Buffer } from 'node:buffer';

import {
    ActionRowBuilder,
    AttachmentBuilder,
    BaseMessageOptions,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Events,
    Message,
    MessageType
} from 'discord.js';

import {Logger, LogLevel } from 'meklog';

import { EasyDiffusionClient } from '../easy-diffusion/EasyDiffusionClient.js';
import { ContentType } from '../../../enums/ContentType.js';
import { EnvironmentSettings } from '../../../models/EnvironmentSettings.js';
import { BufferEncoding } from '../../../enums/BufferEncoding.js';
import { DiscordPresenceStatus } from './enums/DiscordPresenceStatus.js';
import { JavaScriptType } from '../../../enums/JavaScriptType.js';
import { IHttpExchangeWithAttachedResponse } from '../../../models/IHttpExchangeWithAttachedResponse.js';
import { RenderRequest } from '../easy-diffusion/models/requests/RenderRequest.js';
import { IRenderResponse } from '../easy-diffusion/models/responses/IRenderResponse.js';
import { IStreamResponse } from '../easy-diffusion/models/responses/IStreamResponse.js';
import { BotInteraction } from '../../../enums/BotInteraction.js';
import { StableDiffusionGuidanceScaleLimit } from '../easy-diffusion/enums/StableDiffusionGuidanceScaleLimit.js';
import { TypingService } from './services/TypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';

export class DiscordEasyDiffusionClient extends BaseDiscordClient {
    #easyDiffusionClients: Array<EasyDiffusionClient> = [];

    #guidanceScaleInterval = .5;

    get easyDiffusionClients(): Array<EasyDiffusionClient> {
        return this.#easyDiffusionClients;
    }

    set easyDiffusionClients(easyDiffusionClients) {
        this.#easyDiffusionClients = easyDiffusionClients;
    }

    constructor(environmentSettings: EnvironmentSettings, typingService: TypingService) {
        super(environmentSettings, typingService);

        this.environmentSettings = environmentSettings;
        this.typingService = typingService;

        this.logger = new Logger(this.environmentSettings.isProduction, 'DiscordEasyDiffusionClient');

        this.#registerEvents();
    }

    login() {
        this.logger(LogLevel.Info, 'Performing client login...');
        this.client.login(this.environmentSettings.discordToken);
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.client.once(Events.ClientReady, (event) => this.#onClientReady.call(self, event));
        this.client.on(Events.MessageCreate, async (message) => await this.#onMessageCreate.call(self, message));
        this.client.on(Events.InteractionCreate, async (interaction) => await this.#onInteraction.call(self, interaction));
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

        if(!this.#shouldReply(message)) {
            this.logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.logger(LogLevel.Info, 'Replying to message...');

        const renderData = await this.#renderImage(message, null);

        await this.#reply(message, renderData);
    }

    #shouldReply(message: Message): boolean {
        const shouldReply =
            !message.system         // Not a system message.
            && !!message.guild      // The message should be from a guild (server).
            && message.type === MessageType.Default // The message is a default message type.
            && !!message.author.id  // The message should have an author.
            && !message.author.bot  // No messages by bots.
            && !!message.mentions.members?.find(x => x.id === this.client.user?.id) // The message explicitly tags this bot.
            && message.author.id !== this.client.user?.id // No messages by this bot.
            && (
                this.environmentSettings.discordChannels.length === 0
                || this.environmentSettings.discordChannels.includes(message.channel.id)) // The channel is in the configured whitelist if there is one.
            && typeof message.content === JavaScriptType.String  // Only respond to text-based messages.
            && message.content.length > 0;                       // Only respond to messages with more than 0 characters.

        return shouldReply;
    }

    async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, `Beginning interaction response to custom action ${interaction.customId}...`);

        const supportedContentTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ]

        const attachments = Array.from(interaction.message.attachments, ([name, value]) => ({ name, value }));

        const imageAttachment = attachments.filter(attachment =>
            supportedContentTypes.includes(Object.values(ContentType)
                .find(contentTypeValue => contentTypeValue === attachment.value.contentType)))[0].value;

        if(!imageAttachment?.description) {
            return;
        }

        const renderRequest = RenderRequest.JsonFactory(imageAttachment.description);

        await interaction.deferReply();

        switch(interaction.customId) {
            case BotInteraction.Retry:
                this.#retry(interaction, renderRequest.prompt);
                break;
            case BotInteraction.ShowSource:
                this.#showSource(interaction, renderRequest, imageAttachment.description);
                break;
            case BotInteraction.GuidanceScaleMinus:
                renderRequest.guidance_scale = renderRequest.guidance_scale - this.#guidanceScaleInterval < StableDiffusionGuidanceScaleLimit.Min
                    ? renderRequest.guidance_scale
                    : renderRequest.guidance_scale - this.#guidanceScaleInterval

                this.#retry(interaction, renderRequest);
                break;
            case BotInteraction.GuidanceScalePlus:
                renderRequest.guidance_scale = renderRequest.guidance_scale + this.#guidanceScaleInterval > StableDiffusionGuidanceScaleLimit.Max
                    ? renderRequest.guidance_scale
                    : renderRequest.guidance_scale + this.#guidanceScaleInterval;

                this.#retry(interaction, renderRequest);
                break;
            default:
                this.logger(LogLevel.Warning, `An unknown interaction was passed: ${interaction.customId}.`);
                break;
        }
    }

    async #reply(interaction: Message | ButtonInteraction, renderData: IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse> | null) {
        if(renderData?.exchange?.response === null
            && renderData?.response === null
        ) {
            await this.#replyWithError(interaction);
        }

        const renderRequest = renderData.exchange.request;
        const streamResponse = renderData.response;

        const fileName = this.#getFileNameFromPrompt(renderRequest);
        const jsonRequest = JSON.stringify(renderRequest);

        const files: Array<AttachmentBuilder> = [];
        const areInteractionsAvailable = jsonRequest.length <= 1024;

        const imageBuffer = Buffer.from(streamResponse.output[0].data.split(",")[1], BufferEncoding.Base64);

        const imageAttachment = new AttachmentBuilder(imageBuffer, {
            name: `${fileName}.${renderRequest.output_format}`,
            description: areInteractionsAvailable ? jsonRequest : null
        });

        files.push(imageAttachment);

        this.logger(LogLevel.Info, `Attaching render for "${renderRequest.prompt}": ${jsonRequest}`);

        const retryButton = new ButtonBuilder()
            .setCustomId(BotInteraction.Retry)
            .setLabel('🔄')
            .setStyle(ButtonStyle.Secondary);

        const showSourceButton = new ButtonBuilder()
            .setCustomId(BotInteraction.ShowSource)
            .setLabel('{ }')
            .setStyle(ButtonStyle.Secondary);

        const guidanceScaleMinus = new ButtonBuilder()
            .setCustomId(BotInteraction.GuidanceScaleMinus)
            .setLabel('➖')
            .setStyle(ButtonStyle.Secondary);

        const guidanceScalePlusButton = new ButtonBuilder()
            .setCustomId(BotInteraction.GuidanceScalePlus)
            .setLabel('➕')
            .setStyle(ButtonStyle.Secondary);

        const buttonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(retryButton, showSourceButton);

        if(renderRequest.guidance_scale - this.#guidanceScaleInterval > StableDiffusionGuidanceScaleLimit.Min) {
            buttonRow.addComponents(guidanceScaleMinus);
        }

        if(renderRequest.guidance_scale + this.#guidanceScaleInterval < StableDiffusionGuidanceScaleLimit.Max) {
            buttonRow.addComponents(guidanceScalePlusButton);
        }

        const reply: BaseMessageOptions = {
            files,
            components: areInteractionsAvailable ? [buttonRow] : []
        };

        try {
            if(interaction instanceof Message) {
                await interaction.reply(reply);
            } else if(interaction instanceof ButtonInteraction) {
                reply.content = `${interaction.member} re-rendered \`${renderRequest.prompt}\`.`;

                switch(interaction.customId) {
                    case BotInteraction.GuidanceScaleMinus:
                        reply.content = `${reply.content}\n`
                            + `The guidance scale was decreased from ${renderRequest.guidance_scale + this.#guidanceScaleInterval} to ${renderRequest.guidance_scale}.`;
                        break;
                    case BotInteraction.GuidanceScalePlus:
                        reply.content = `${reply.content}\n`
                            + `The guidance scale was increased from ${renderRequest.guidance_scale - this.#guidanceScaleInterval} to ${renderRequest.guidance_scale}.`;
                        break;
                }

                await (interaction as ButtonInteraction).editReply(reply);
            } else {
                throw new Error(`An invalid interaction was provided: ${typeof interaction}`);
            }
        } catch (error) {
            this.logger(LogLevel.Error, `An exception occurred while replying to a message: ${error}`);
            await this.#replyWithError(interaction);
        }
    }

    async #retry(interaction: ButtonInteraction, prompt: string | RenderRequest): Promise<void> {
        const renderData = await this.#renderImage(interaction, prompt);
        await this.#reply(interaction, renderData);
    }

    async #showSource(interaction, renderRequest, jsonRequest): Promise<void> {
        const jsonBuffer = Buffer.from(jsonRequest, BufferEncoding.UTF8);
        const jsonAttachment = new AttachmentBuilder(jsonBuffer, {
            name: `${this.#getFileNameFromPrompt(renderRequest)}.json`
        });

        const reply = {
            content: `${interaction.member} wanted to see the request message for \`${renderRequest.prompt}\`.`,
            files: [jsonAttachment]
        };

        await interaction.editReply(reply);
    }

    #getFileNameFromPrompt(renderRequest: RenderRequest): string {
        return `${renderRequest.seed}_${renderRequest.prompt}`.substring(0, 128);
    }

    async #renderImage(interaction: Message | ButtonInteraction, prompt: string | RenderRequest |  null)
        : Promise<IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse> | null> {
        let botMention: string = '';
        prompt = prompt || '';

        if(interaction instanceof Message && !(prompt instanceof RenderRequest)) {
            botMention = interaction.mentions.members.find(x => x.id === this.client.user?.id)?.toString() || '';
            prompt = interaction.content;
        }

        prompt = prompt instanceof RenderRequest
            ? prompt
            : prompt.replace(botMention, '').trim();

        if(typeof prompt === JavaScriptType.String && (prompt as string).substring(0, 1) === '{') {
            try {
                prompt = RenderRequest.JsonFactory(prompt as string);
                prompt.num_outputs = 1;
            } catch(error) {
                this.logger(LogLevel.Info, `A possible JSON prompt was received, but could not be deserialized to ${typeof RenderRequest}.`);
            }
        }

        await this.typingService.startTyping(interaction, () => DiscordEasyDiffusionClient.shouldBeTyping(this));

        const easyDiffusionClient = new EasyDiffusionClient(this.environmentSettings);
        this.#easyDiffusionClients.push(easyDiffusionClient);

        this.logger(LogLevel.Info, `Render prompt: ${prompt}`);

        const renderExchange = await easyDiffusionClient.render(prompt);

        if(renderExchange === null || renderExchange.response === null) {
            return null;
        }

        const streamResponse = await easyDiffusionClient.stream(renderExchange);

        return {
            exchange: renderExchange,
            response: streamResponse
        };
    }

    async #replyWithError(message: Message | ButtonInteraction): Promise<void> {
        await message.reply({ content: this.environmentSettings.errorMessage });
    }

    static shouldBeTyping(client: DiscordEasyDiffusionClient): boolean {
        client.easyDiffusionClients = client.easyDiffusionClients.filter(x => x.isBusy);
        return client.easyDiffusionClients.length > 0;
    }
}
