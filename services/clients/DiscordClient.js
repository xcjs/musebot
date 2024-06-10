import { AttachmentBuilder, Client, Events, GatewayIntentBits, MessageType, Partials } from 'discord.js';
import {Logger, LogLevel } from 'meklog'

import { EasyDiffusionClient } from './EasyDiffusionClient.js';

export class DiscordClient {
    #environmentSettings = null;
    #client = null;
    #logger = null;

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

    async #onClientReady(event) {
        this.#logger(LogLevel.Info, 'Client is ready.');
        await this.#client.guilds.fetch();
        this.#client.user.setPresence({ activities: [], status: 'online' });
    }

    async #onMessageCreate(message) {
        this.#logger(LogLevel.Info, `Discord message created. "${message.author.displayName} (${message.author.username}): ${message}"`);

        await message.fetch();

        if(!this.#shouldReply(message)) {
            this.#logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.#logger(LogLevel.Info, 'Replying to message...');
    }

    #shouldReply(message) {
        const shouldReply =
            !!message.guild
            && !!message.author.id // The message should have an author.
            && !message.author.bot  // No messages by bots.
            && !!message.mentions.members.find(x => x.id === this.#client.user.id) // The message explicitly tags this bot.
            && message.author.id !== this.#client.user.id // No messages by this bot.
            && (
                this.#environmentSettings.discordChannels.length === 0
                || this.#environmentSettings.discordChannels.includes(message.channel.id)) // The channel is in the configured whitelist if there is one.
            && typeof message.content === 'string' // Only respond to text-based messages.
            && message.content.length > 0; // Only respond to messages with more than 0 characters.

        return shouldReply;
    }
}
