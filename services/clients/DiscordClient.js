import { AttachmentBuilder, Client, Events, GatewayIntentBits, MessageType, Partials } from 'discord.js';

import { EasyDiffusionClient } from '/services/clients/EasyDiffusionClient';

export class DiscordClient {
    #environmentSettings = null;
    #client = null;

    constructor(environmentSettings) {
        this.#environmentSettings = environmentSettings;

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
        this.#client.login(this.#environmentSettings.discordToken);
    }

    #registerEvents() {
        client.once(Events.ClientReady, this.#onClientReady);
        client.on(Events.MessageCreate, this.#onMessageCreate);
    }

    async #onClientReady() {
        await this.#client.guilds.fetch();
        this.#client.user.setPresence({ activities: [], status: 'online' });
    }

    async #onMessageCreate(message) {
        await message.fetch();
        const channelId = message.channel.id;

        // Do nothing if the channelId isn't in the channel whitelist.
        if (message.guild && !this.#environmentSettings.discordChannels.includes(channelId)) {
            return;
        }
    }
}
