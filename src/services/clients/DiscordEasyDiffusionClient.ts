import { Buffer } from 'node:buffer';

import {
    ActionRowBuilder,
    AttachmentBuilder,
    BaseMessageOptions,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Client as DiscordClient,
    Events,
    GatewayIntentBits,
    Message,
    MessageType,
    Partials
} from 'discord.js';

import {Logger, LogLevel } from 'meklog'

import { EasyDiffusionClient } from './easy-diffusion/EasyDiffusionClient.js';
import { ContentType } from '../../enums/ContentType.js';
import { EnvironmentSettings } from '../../models/EnvironmentSettings.js';
import { BufferEncoding } from '../../enums/BufferEncoding.js';
import { DiscordPresenceStatus } from '../../enums/DiscordPresenceStatus.js';
import { JavaScriptType } from '../../enums/JavaScriptType.js';
import { MusebotInteractionCustomId } from '../../enums/MusebotInteractionCustomId.js';

export class DiscordEasyDiffusionClient {
    #environmentSettings: EnvironmentSettings;

    #client: DiscordClient;
    #logger;

    #sendTypingIntervalMilliseconds = 1000;
    #typingInterval: NodeJS.Timeout | null = null;

    #easyDiffusionClients: Array<EasyDiffusionClient> = [];

    constructor(environmentSettings) {
        this.#environmentSettings = environmentSettings;
        this.#logger = new Logger(this.#environmentSettings.isProduction, 'DiscordClient');

        this.#client = new DiscordClient({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent
            ],
            allowedMentions: { users: [], roles: [], repliedUser: false },
            partials: [
                Partials.Channel
            ]
        });

        this.#registerEvents();
    }

    login() {
        this.#logger(LogLevel.Info, 'Performing client login...');
        this.#client.login(this.#environmentSettings.discordToken);
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.#client.once(Events.ClientReady, (event) => this.#onClientReady.call(self, event));
        this.#client.on(Events.MessageCreate, (message) => this.#onMessageCreate.call(self, message));
        this.#client.on(Events.InteractionCreate, (interaction) => this.#onInteraction.call(self, interaction));
    }

    async #onClientReady() {
        if(this.#client.user === null) {
            return;
        }

        this.#logger(LogLevel.Info, 'Client is ready.');
        this.#client.user.setPresence({ activities: [], status: DiscordPresenceStatus.Online });
    }

    async #onMessageCreate(message: Message) {
        this.#logger(LogLevel.Info, `Discord message created. ${message.author.displayName} (${message.author.username}): "${message}"`);

        if(!this.#shouldReply(message)) {
            this.#logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.#logger(LogLevel.Info, 'Replying to message...');

        const renderData = await this.#renderImage(message);

        await this.#reply(message, renderData);
    }

    #shouldReply(message: Message) {
        const shouldReply =
            !message.system         // Not a system message.
            && !!message.guild      // The message should be from a guild (server).
            && message.type === MessageType.Default // The message is a default message type.
            && !!message.author.id  // The message should have an author.
            && !message.author.bot  // No messages by bots.
            && !!message.mentions.members?.find(x => x.id === this.#client.user?.id) // The message explicitly tags this bot.
            && message.author.id !== this.#client.user?.id // No messages by this bot.
            && (
                this.#environmentSettings.discordChannels.length === 0
                || this.#environmentSettings.discordChannels.includes(message.channel.id)) // The channel is in the configured whitelist if there is one.
            && typeof message.content === JavaScriptType.String  // Only respond to text-based messages.
            && message.content.length > 0;                       // Only respond to messages with more than 0 characters.

        return shouldReply;
    }

    async #onInteraction(interaction: ButtonInteraction) {
        this.#logger(LogLevel.Info, `Beginning interaction response to custom action ${interaction.customId}...`);

        const supportedContentTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ]

        const attachments = Array.from(interaction.message.attachments, ([name, value]) => ({ name, value }));

        const imageAttachment = attachments.filter(x =>
            supportedContentTypes.includes(ContentType[x.value.contentType as keyof typeof ContentType]))[0].value;

        if(!imageAttachment?.description) {
            return;
        }

        const renderRequest = JSON.parse(imageAttachment.description);

        await interaction.deferReply();

        switch(interaction.customId) {
            case MusebotInteractionCustomId.Retry:
                this.#retry(interaction, renderRequest);
                break;
            case MusebotInteractionCustomId.ShowSource:
                this.#showSource(interaction, renderRequest, imageAttachment.description);
                break;
        }
    }

    async #reply(message: Message | ButtonInteraction, renderData) {
        if(renderData?.renderExchange?.response !== null
            && renderData?.streamResponse != null
        ) {
            const renderRequest = renderData.renderExchange.request;
            const streamResponse = renderData.streamResponse;

            const fileName = this.#getFileNameFromPrompt(renderRequest);
            const jsonRequest = JSON.stringify(renderRequest);

            const files: Array<AttachmentBuilder> = [];
            const allowInteractions = jsonRequest.length <= 1024;

            const imageBuffer = Buffer.from(streamResponse.output[0].data.split(",")[1], BufferEncoding.Base64);

            const imageAttachment = new AttachmentBuilder(imageBuffer, {
                name: `${fileName}.${renderRequest.output_format}`,
                description: allowInteractions ? jsonRequest : undefined
            });

            files.push(imageAttachment);

            this.#logger(LogLevel.Info, `Attaching render for "${renderRequest.prompt}": ${jsonRequest}`);

            const retryButton = new ButtonBuilder()
                .setCustomId('retry')
                .setLabel('🔄')
                .setStyle(ButtonStyle.Secondary);

            const showSourceButton = new ButtonBuilder()
                .setCustomId('showSource')
                .setLabel('📝')
                .setStyle(ButtonStyle.Secondary);

            const buttonRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(retryButton, showSourceButton);

            const reply: BaseMessageOptions = {
                files,
                components: allowInteractions ? [buttonRow] : []
            };

            try {
                switch(typeof message) {
                    case (typeof Message):

                        break;
                    case (typeof ButtonInteraction):

                        break;
                    default:
                        throw new Error(`An invalid interaction was provided: ${typeof message}`);
                }

                if(message instanceof ButtonInteraction) {
                    reply.content = `${message.member} re-rendered \`${renderRequest.prompt}\`.`;
                    await message.editReply(reply);
                } else {
                        await message.reply(reply);
                }
            } catch (error) {
                this.#logger(LogLevel.Error, `An exception occurred while replying to a message: ${error}`);
                await this.#replyWithError(message);
            }
        } else {
            await this.#replyWithError(message);
        }
    }

    async #retry(interaction, renderRequest) {
        interaction.content = renderRequest.prompt;
        const renderData = await this.#renderImage(interaction);

        await this.#reply(interaction, renderData);
    }

    async #showSource(interaction, renderRequest, jsonRequest) {
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

    #getFileNameFromPrompt(renderRequest) {
        return `${renderRequest.seed}_${renderRequest.prompt}`.substring(0, 128);
    }

    async #startTyping(message: Message) {
        if(this.#typingInterval !== null) {
            return;
        }'utf-8'

        try {
            await this.#onTypingInterval(message);

            this.#typingInterval = setInterval(async () => {
                await this.#onTypingInterval(message);
            }, this.#sendTypingIntervalMilliseconds);

            console.log(`Registered typing interval as interval #${this.#typingInterval}.`)
        } catch(error) {
            this.#logger(LogLevel.Error, `An error occurred while sending the typing status: ${error}`);
            this.#stopTyping();
        }
    }

    async #onTypingInterval(message: Message) {
        if(this.#easyDiffusionClients.filter(x => x.isBusy).length > 0) {
            await message.channel.sendTyping();
        }
    }

    #stopTyping(): void {
        if(this.#easyDiffusionClients.filter(x => x.isBusy).length !== 0) {
            return;
        }

        this.#logger(LogLevel.Info, `Stopped typing and clearing interval #${this.#typingInterval}.`);
        this.#typingInterval = null;
        this.#easyDiffusionClients = [];

        if(this.#typingInterval !== null) {
            clearInterval(this.#typingInterval);
        }
    }

    async #renderImage(message: Message) {
        await this.#startTyping(message);

        const easyDiffusionClient = new EasyDiffusionClient(this.#environmentSettings);
        this.#easyDiffusionClients.push(easyDiffusionClient);

        const botMention = message.mentions?.members?.find(x => x.id === this.#client.user?.id)?.toString() || '';
        const prompt = message.content.replace(botMention, '').trim();

        this.#logger(LogLevel.Info, `Render prompt: ${prompt}`);

        const renderExchange = await easyDiffusionClient.render(prompt);

        if(renderExchange === null || renderExchange.response === null) {
            return null;
        }

        const streamResponse = await easyDiffusionClient.stream(renderExchange);

        this.#stopTyping();

        return {
            renderExchange,
            streamResponse
        };
    }

    async #replyWithError(message: Message | ButtonInteraction): Promise<void> {
        await message.reply({ content: this.#environmentSettings.errorMessage });
    }
}
