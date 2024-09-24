import { ButtonInteraction, Client as DiscordClient, Message, MessageType } from 'discord.js';

import { JavaScriptType } from '../../../../enums/JavaScriptType.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';

export class ReplyService {
    #environmentSettings: EnvironmentSettings;
    #discordClient: DiscordClient;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
    }

    shouldReply(message: Message): boolean {
        const shouldReply =
            !message.system         // Not a system message.
            && !!message.guild      // The message should be from a guild (server).
            && message.type === MessageType.Default // The message is a default message type.
            && !!message.author.id  // The message should have an author.
            && !message.author.bot  // No messages by bots.
            && !!message.mentions.members?.find(x => x.id === this.#discordClient.user?.id) // The message explicitly tags this bot.
            && message.author.id !== this.#discordClient.user?.id // No messages by this bot.
            && (
                this.#environmentSettings.discordChannels.length === 0
                || this.#environmentSettings.discordChannels.includes(message.channel.id)) // The channel is in the configured whitelist if there is one.
            && typeof message.content === JavaScriptType.String  // Only respond to text-based messages.
            && message.content.length > 0;                       // Only respond to messages with more than 0 characters.

        return shouldReply;
    }

    async replyWithError(interaction: Message | ButtonInteraction): Promise<void> {
        await interaction.reply({ content: this.#environmentSettings.errorMessage });
    }
}
