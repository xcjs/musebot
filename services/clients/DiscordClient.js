import { AttachmentBuilder, Client, Events, GatewayIntentBits, MessageType, Partials } from 'discord.js';
import {Logger, LogLevel } from 'meklog'

import { EasyDiffusionClient } from '/services/clients/EasyDiffusionClient';

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
        this.#logger(LogLevel.Info, `Creating message "${message}"`);
        await message.fetch();
        const channelId = message.channel.id;

        // Do nothing if the channelId isn't in the channel whitelist.
        if (message.guild && !this.#environmentSettings.discordChannels.includes(channelId)) {
            return;
        }
    }
}
