import { Attachment, ButtonInteraction, Client as DiscordClient, Message, MessageType  } from 'discord.js';

import { ContentType } from '../../../../../enums/ContentType.js';
import { JavaScriptType } from '../../../../../enums/JavaScriptType.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { IReplyService } from '../../IReplyService.js';

export abstract class BaseReplyService implements IReplyService {
    #environmentSettings: IEnvironmentSettings;
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

    reply(): Promise<void> {
        throw 'The reply() implementation must be overridden.';
    }

    getAttachmentsByType(interaction: Message | ButtonInteraction, contentTypes: Array<ContentType>): Array<Attachment> {
        let attachments: Array<Attachment>;

        if (interaction instanceof Message) {
            attachments = Array.from(interaction.attachments, ([name, value]) => ({ name, value })).map(x => x.value);
        } else if (interaction instanceof ButtonInteraction) {
            attachments = Array.from(interaction.message.attachments, ([name, value]) => ({ name, value })).map(x => x.value);
        }

        const matchingAttachments = attachments.filter(attachment =>
            contentTypes.includes(Object.values(ContentType)
                .find(contentTypeValue => contentTypeValue === attachment.contentType)));

        return matchingAttachments;
    }

    async replyWithError(interaction: Message | ButtonInteraction): Promise<void> {
        await interaction.reply({ content: this.#environmentSettings.errorMessage });
    }
}
