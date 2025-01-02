import { Attachment, AttachmentBuilder, ButtonInteraction, Client as DiscordClient, Message, MessageType, User  } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { ContentType } from '../../../../../enums/ContentType.js';
import { getRandomInt } from '../../../../../utilities/random-utilities.js';
import { splitText } from '../../../../../utilities/string-utilities.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { IReplyService } from '../../IReplyService.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class ReplyService implements IReplyService {
    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;

    #logger;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ReplyService');
    }

    shouldReply(message: Message, isReaction: boolean = false): boolean {
        // The message is system message.
        if(message.system) {
            this.#logger(LogLevel.Info, 'Not replying to a system message.');
            return false;
        }

        // The message isn't from a guild (server).
        if(!message.guild) {
            this.#logger(LogLevel.Info, 'Not replying to a non-guild message.');
            return false;
        }

        // The message is not a default message type and not a reaction reply
        // unless it's a reply to an LLM.
        if (message.type !== MessageType.Default
            && message.type !== MessageType.Reply
            && !isReaction) {
            this.#logger(LogLevel.Info, 'Not replying to a non-default or non-reaction message.');
            return false;
        }

        // The has no author.
        if(!message.author.id) {
            this.#logger(LogLevel.Info, 'Not replying to a message without an author.');
            return false;
        }

        // No messages by bots unless it's a reaction reply.
        if (message.author.bot && !isReaction) {
            this.#logger(LogLevel.Info, 'Not replying to any other bots/apps.');
            return false;
        }

        // The bot requires a mention and isn't a reaction reply.
        if ((this.#environmentSettings.botRequiresMention &&
            !message.mentions.members?.find(x => x.id === this.#discordClient.user?.id))
            && !isReaction) {
            this.#logger(LogLevel.Info, 'Not replying to a message that doesn\'t mention or react to this bot.');
            return false;
        }

        // The bot doesn't require a mention and doesn't fall within the
        // response rate, except for reactions. It should still always reply
        // to a direct mention.
        const generatedResponseRate = getRandomInt(1, 100);

        if ((!this.#environmentSettings.botRequiresMention
            && generatedResponseRate > this.#environmentSettings.botResponseRate)
            && !message.mentions.members?.find(x => x.id === this.#discordClient.user?.id)
                && !isReaction) {
            this.#logger(LogLevel.Info, `Not replying to a message outside the response rate` +
                ` (${generatedResponseRate} > ${this.#environmentSettings.botResponseRate}).`);
            return false;
        }

        // The bot can't reply to itself unless it's in response to a reaction.
        if (message.author.id === this.#discordClient.user?.id && !isReaction) {
            this.#logger(LogLevel.Info, 'Not replying to a myself.');
            return false;
        }

        // The channel isn't in the configured whitelist if there is one.
        if (this.#environmentSettings.discordChannels.length > 0
            && !this.#environmentSettings.discordChannels.includes(message.channel.id)) {
            this.#logger(LogLevel.Info, 'Not replying to a message in a channel outside this bot\'s allowed channels.');
            return false;
        }

        // The message has no content and is not a reaction.
        if (message.content.length === 0 && !isReaction) {
            this.#logger(LogLevel.Info, 'Not replying to a message with no content.');
            return false;
        }

        // If the bot is replying to a reaction, it must be to this bot's message.
        if(isReaction && message.author.id !== this.#discordClient.user?.id) {
            this.#logger(LogLevel.Info, 'Not replying to a reaction not on my message.');
            return false;
        }

        return true;
    }

    async reply(
        interaction: Message | ButtonInteraction,
        content: string | null,
        attachments: Array<AttachmentBuilder> = []
    ): Promise<void> {
        const replyContents = splitText(content?.trim() || '', DiscordConstants.ContentMaxLength);

        replyContents.forEach(async (contentFragment, i) => {
            const replyAttachments = i + 1 === replyContents.length ? attachments : [];

            if (interaction instanceof Message) {
                await interaction.reply({
                    content: contentFragment.trim(),
                    files: replyAttachments
                });
            } else if (interaction instanceof ButtonInteraction && i === 0) {
                await interaction.editReply({
                    content: contentFragment.trim(),
                    files: replyAttachments
                });
            } else if (interaction instanceof ButtonInteraction && i > 0) {
                await interaction.followUp({
                    content: contentFragment.trim(),
                    files: replyAttachments
                });
            } else {
                this.#logger(LogLevel.Warning,
                    `An interaction occurred that did not fit the reply criteria of either being an edited reply to a`
                    + ` ${typeof ButtonInteraction} nor a direct reply to any type of interaction.`);
            }
        });
    }

    mention(user: User): string {
        return `<@${user.id}>`;
    }

    getAttachmentsByType(interaction: Message | ButtonInteraction, contentTypes: Array<ContentType>): Array<Attachment> {
        this.#logger(LogLevel.Info, 'Looking for attachments of the following types on a message:', contentTypes);

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

    async getAttachedImagesAsBase64(interaction: Message | ButtonInteraction): Promise<Array<string>> {
        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachments = this.getAttachmentsByType(interaction, imageTypes);
        const imagesAsBase64: Array<string> = [];

        if(imageAttachments.length === 0) {
            return imagesAsBase64;
        }

        for (const attachment of imageAttachments) {
            const imageResponse = await fetch(attachment.url);
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            imagesAsBase64.push(imageBuffer.toString(BufferEncoding.Base64));
        }

        return imagesAsBase64;
    }

    async replyWithError(interaction: Message | ButtonInteraction): Promise<void> {
        await interaction.reply({ content: this.#environmentSettings.errorMessage });
    }
}
