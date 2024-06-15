import { Buffer } from 'node:buffer';

import { AttachmentBuilder, Client, Events, GatewayIntentBits, MessageType, Partials } from 'discord.js';
import {Logger, LogLevel } from 'meklog'

import { EasyDiffusionClient } from './EasyDiffusionClient.js';

export class DiscordEasyDiffusionClient {
    #environmentSettings = null;

    #client = null;
    #logger = null;

    #sendTypingIntervalMilliseconds = 1000;
    #typingInterval = null;

    #easyDiffusionClients = [];

    constructor(environmentSettings) {
        this.#environmentSettings = environmentSettings;
        this.#logger = new Logger(this.#environmentSettings.isProduction, 'DiscordClient');

        this.#client = new Client({
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
        const self = this;

        this.#client.once(Events.ClientReady, (event) => this.#onClientReady.call(self, event));
        this.#client.on(Events.MessageCreate, (message) => this.#onMessageCreate.call(self, message));
    }

    async #onClientReady() {
        this.#logger(LogLevel.Info, 'Client is ready.');
        this.#client.user.setPresence({ activities: [], status: 'online' });
    }

    async #onMessageCreate(message) {
        this.#logger(LogLevel.Info, `Discord message created. ${message.author.displayName} (${message.author.username}): "${message}"`);

        if(!this.#shouldReply(message)) {
            this.#logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.#logger(LogLevel.Info, 'Replying to message...');

        await this.#startTyping(message);
        const renderData = await this.#renderImage(message);
        this.#stopTyping();

        if(renderData?.renderExchange?.response !== null
            && renderData?.streamResponse != null
        ) {
            const renderRequest = renderData.renderExchange.request;
            const streamResponse = renderData.streamResponse;

            const fileName = `${renderRequest.seed}_${renderRequest.prompt}`.substring(0, 128);

            let files = [];

            const imageBuffer = new Buffer.from(streamResponse.output[0].data.split(",")[1], 'base64');
            const imageAttachment = new AttachmentBuilder(imageBuffer, {
                name: `${fileName}.jpg`
            });

            files.push(imageAttachment);

            const jsonRequest = JSON.stringify(renderRequest);
            this.#logger(LogLevel.Info, `Attaching render for "${renderRequest.prompt}": ${jsonRequest}`);

            if(this.#environmentSettings.botEmbedsJson) {
                const jsonBuffer = new Buffer.from(jsonRequest, 'utf-8');
                const jsonAttachment = new AttachmentBuilder(jsonBuffer, {
                    name: `${fileName}.json`
                });

                files.push(jsonAttachment);
            }

            await message.reply({ files });
        } else {
            await message.reply({ content: 'The dreams would not form for me this time. Maybe they will answer our call later.' });
        }
    }

    #shouldReply(message) {
        const shouldReply =
            !message.system         // Not a system message.
            && !!message.guild      // The message should be from a guild (server).
            && message.type === MessageType.Default // The message is a default message type.
            && !!message.author.id  // The message should have an author.
            && !message.author.bot  // No messages by bots.
            && !!message.mentions.members.find(x => x.id === this.#client.user.id) // The message explicitly tags this bot.
            && message.author.id !== this.#client.user.id // No messages by this bot.
            && (
                this.#environmentSettings.discordChannels.length === 0
                || this.#environmentSettings.discordChannels.includes(message.channel.id)) // The channel is in the configured whitelist if there is one.
            && typeof message.content === 'string'  // Only respond to text-based messages.
            && message.content.length > 0;          // Only respond to messages with more than 0 characters.

        return shouldReply;
    }

    async #startTyping(message) {
        if(this.#typingInterval !== null) {
            return;
        }

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

    async #onTypingInterval(message) {
        if(this.#easyDiffusionClients.filter(x => x.isBusy).length > 0) {
            await message.channel.sendTyping();
        }
    }

    #stopTyping() {
        if(this.#easyDiffusionClients.filter(x => x.isBusy).length === 0) {
            this.#logger(LogLevel.Info, `Stopped typing and clearing interval #${this.#typingInterval}.`);
            clearInterval(this.#typingInterval);
            this.#typingInterval = null;
            this.#easyDiffusionClients = [];
        }
    }

    async #renderImage(message) {
        const easyDiffusionClient = new EasyDiffusionClient(this.#environmentSettings);
        this.#easyDiffusionClients.push(easyDiffusionClient);

        const botMention = message.mentions.members.find(x => x.id === this.#client.user.id).toString();
        const prompt = message.content.replace(botMention, '').trim();

        this.#logger(LogLevel.Info, `Render prompt: ${prompt}`);

        const renderExchange = await easyDiffusionClient.render(prompt);

        if(renderExchange.response === null) {
            return null;
        }

        const streamResponse = await easyDiffusionClient.stream(renderExchange);

        return {
            renderExchange,
            streamResponse
        };
    }
}
