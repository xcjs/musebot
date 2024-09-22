import { ButtonInteraction, Message, MessageType } from 'discord.js';

import { JavaScriptType } from '../../../../enums/JavaScriptType.js';
import { IServiceContainer } from '../../../IServiceContainer.js';

export class ReplyService {
    #services: IServiceContainer;

    constructor(services: IServiceContainer) {
        this.#services = services;
    }

    shouldReply(message: Message): boolean {
        const shouldReply =
            !message.system         // Not a system message.
            && !!message.guild      // The message should be from a guild (server).
            && message.type === MessageType.Default // The message is a default message type.
            && !!message.author.id  // The message should have an author.
            && !message.author.bot  // No messages by bots.
            && !!message.mentions.members?.find(x => x.id === this.#services.discordClient.user?.id) // The message explicitly tags this bot.
            && message.author.id !== this.#services.discordClient.user?.id // No messages by this bot.
            && (
                this.#services.environmentSettings.discordChannels.length === 0
                || this.#services.environmentSettings.discordChannels.includes(message.channel.id)) // The channel is in the configured whitelist if there is one.
            && typeof message.content === JavaScriptType.String  // Only respond to text-based messages.
            && message.content.length > 0;                       // Only respond to messages with more than 0 characters.

        return shouldReply;
    }

    async replyWithError(interaction: Message | ButtonInteraction): Promise<void> {
        await interaction.reply({ content: this.#services.environmentSettings.errorMessage });
    }
}
