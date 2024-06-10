import { AttachmentBuilder, Client, Events, GatewayIntentBits, MessageType, Partials } from 'discord.js';
import {Logger, LogLevel } from 'meklog'

import { EasyDiffusionClient } from '/services/clients/EasyDiffusionClient.js';

export class DiscordClient {
    #environmentSettings = null;
    #client = null;
    #logger = null;

    constructor(environmentSettings) {
        this.#environmentSettings = environmentSettings;
        this.#logger = new Logger(this.isProduction, 'DiscordClient');

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
        this.#logger(LogLevel.Info, 'Performing client login.');
        this.#client.login(this.#environmentSettings.discordToken);
    }

    #registerEvents() {
        client.once(Events.ClientReady, this.#onClientReady);
        client.on(Events.MessageCreate, this.#onMessageCreate);
    }

    async #onClientReady() {
        this.#logger(LogLevel.Info, 'Client is ready.');
        await this.#client.guilds.fetch();
        this.#client.user.setPresence({ activities: [], status: 'online' });
    }

    async #onMessageCreate(message) {
        this.#logger(LogLevel.Info, `Discord message created: "${message}"`);

        await message.fetch();

        if(!this.#shouldReply(message)) {
            this.#logger(LogLevel.Info, 'Reply should not be created - skipping.')
            return;
        }
    }

    #shouldReply(message) {
        return
            !message.author.id // No messages without authors.
            && !message.author.bot  // No messages by bots.
            && message.author.id !== this.#client.user.id // No messages by this bot.
            && !message.guild // Not a guild message.
            && this.#environmentSettings.discordChannels.includes(message.channel.id) // The channel is in the configured whitelist.
            && typeof message.content === 'string' // Only respond to text-based messages.
            && message.content.length > 0; // Only respond to messages with more than 0 characters.
    }
}
