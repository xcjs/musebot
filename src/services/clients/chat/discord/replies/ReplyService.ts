import { Attachment, BaseMessageOptions, ButtonInteraction, Client as DiscordClient, Message, MessageReaction, MessageType, User  } from 'discord.js';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { ContentType } from '../../../../../enums/ContentType.js';
import { getRandomInt } from '../../../../../utilities/random-utilities.js';
import { splitText } from '../../../../../utilities/string-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { IReplyService } from '../../IReplyService.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class ReplyService implements IReplyService {
    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #logger: ILogger;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;

        this.#logger = services.getLogger('ReplyService');
    }

    shouldReply(message: Message, reaction: MessageReaction = null): boolean {
        if(reaction !== null) {
            // If the bot is replying to a reaction, it must be to this bot's message.
            if (message.author.id !== this.#discordClient.user?.id) {
                this.#logger.info('Not replying to a reaction not on my message.');
                return false;
            }

            if(reaction.me) {
                this.#logger.info('Not replying to a reaction from myself.');
                return false;
            }
        } else {
            // The message is system message.
            if (message.system) {
                this.#logger.info('Not replying to a system message.');
                return false;
            }

            // The message is private and not from a member in a private message
            // role.
            if (!message.guild && !(this.#environmentSettings.botPrivateMessageUsers.includes(message.author.username))) {
                this.#logger.info('Not replying to a non-guild message that\'s not from someone in a private messaging role.');
                return false;
            }

            // The message is not a default message type and not a reaction
            // reply unless it's a reply to an LLM.
            if (message.type !== MessageType.Default
                && message.type !== MessageType.Reply) {
                this.#logger.info('Not replying to a non-default or non-reaction message.');
                return false;
            }

            // The message has no author.
            if (!message.author.id) {
                this.#logger.info('Not replying to a message without an author.');
                return false;
            }

            // The bot can't reply to itself.
            if (message.author.id === this.#discordClient.user?.id) {
                this.#logger.info('Not replying to myself.');
                return false;
            }

            // The bot can't reply to another bot.
            if (message.author.bot) {
                this.#logger.info('Not replying to any other bots/apps.');
                return false;
            }

            // The bot requires a mention within a guild.
            if (message.guild !== null
                && (this.#environmentSettings.botRequiresMention
                    && !message.mentions.members?.find(x => x.id === this.#discordClient.user?.id))) {
                // Before declining to respond, check if the bot's role has been mentioned.
                const botRole = message.guild.members?.resolve(this.#discordClient.user).roles.botRole;

                if (message.mentions.roles.find(x => x.id === botRole?.id) === undefined) {
                    this.#logger.info('Not replying to a message that doesn\'t mention or react to this bot or its role.');
                    return false;
                }
            }

            // The bot doesn't require a mention and doesn't fall within the
            // response rate, except for reactions. It should still always reply
            // to a direct mention.
            const generatedResponseRate = getRandomInt(1, 100);

            if ((!this.#environmentSettings.botRequiresMention
                && generatedResponseRate > this.#environmentSettings.botResponseRate)
                && !message.mentions.members?.find(x => x.id === this.#discordClient.user?.id)) {
                this.#logger.info(`Not replying to a message outside the response rate` +
                    ` (${generatedResponseRate} > ${this.#environmentSettings.botResponseRate}).`);
                return false;
            }

            // The channel isn't in the configured whitelist if there is one.
            if (message.guild !== null
                && this.#environmentSettings.discordChannels.length > 0
                && !this.#environmentSettings.discordChannels.includes(message.channel.id)) {
                this.#logger.info('Not replying to a message in a channel outside this bot\'s allowed channels.');
                return false;
            }

            // The channel is in the configured blacklist if there is one.
            if (message.guild !== null
                && this.#environmentSettings.discordChannelsDisallowed.length > 0
                && this.#environmentSettings.discordChannelsDisallowed.includes(message.channel.id)) {
                this.#logger.info('Not replying to a message in a disallowed channel.');
                return false;
            }

            // The message has no content and is not a reaction.
            if (message.content.length === 0) {
                this.#logger.info('Not replying to a message with no content.');
                return false;
            }
        }

        return true;
    }

    async reply(
        interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions,
        isEdit: boolean = false
    ): Promise<void> {
        const replyContents = splitText(reply.content?.trim() || '', DiscordConstants.ContentMaxLength);

        // Replies without text content will result in an empty array and skip
        // the reply loop.
        if(replyContents.length === 0) {
            replyContents.push('');
        }

        let i = 0;

        for (const contentFragment of replyContents) {
            // All attachments should be added to the last message of a series
            // of split responses.
            const replyAttachments = i + 1 === replyContents.length ? reply.files : [];

            if (interaction instanceof Message && !isEdit) {
                await interaction.reply({
                    content: contentFragment.trim(),
                    files: replyAttachments,
                    components: reply.components
                });
            } else if(interaction instanceof Message && isEdit) {
                await interaction.edit({
                    content: interaction.content,
                    files: reply.files,
                    components: interaction.components
                });
            } else if (interaction instanceof ButtonInteraction && i === 0) {
                const replyFragment: BaseMessageOptions = {
                    content: contentFragment.trim(),
                    files: replyAttachments,
                    components: reply.components
                };

                await interaction.message.reply(replyFragment);

            } else if (interaction instanceof ButtonInteraction && i > 0) {
                const replyFragment: BaseMessageOptions = {
                    content: contentFragment.trim(),
                    files: replyAttachments,
                    components: reply.components
                }

                await interaction.message.reply(replyFragment);
            } else {
                this.#logger.warn(
                    `An interaction occurred that did not fit the reply criteria of either being an edited reply to a`
                    + ` ${typeof ButtonInteraction} nor a direct reply to any type of interaction.`);
            }

            i++;
        }
    }

    getMessageWithoutBotMentions(message: Message): string {
        this.#logger.info('Stripping any bot mentions from the message content.');

        if(message.content === null) {
            this.#logger.info('There is no content in the message - skipping.');
            return '';
        }

        let messageContent = message.content;

        const botMention = this.mention(this.#discordClient.user) ?? '';
        messageContent = message.content.replaceAll(botMention, '').trim();

        const botRole = message.guild?.members.resolve(this.#discordClient.user).roles.botRole || null;
        const botRoleMention = message.mentions.roles.find(x => x.id === botRole?.id)?.toString() || '';

        messageContent = messageContent.replaceAll(botRoleMention, '');

        messageContent = messageContent.trim();

        this.#logger.info(`Returning "${message.content}" as "${messageContent}".`);

        return messageContent;
    }

    mention(user: User | null | undefined): string {
        if(user === null || user === undefined) {
            return '';
        }

        return `<@${user.id}>`;
    }

    async getAllAntecedentPrompts(message: Message): Promise<string[]> {
        const prompts: string[] = [];
        let currentMessage = message;

        while (currentMessage.reference !== null) {
            const antecedentMessage = await currentMessage.fetchReference();

            if (antecedentMessage.content !== null && antecedentMessage.content.length > 0) {
                prompts.push(this.getMessageWithoutBotMentions(antecedentMessage));
            }

            currentMessage = antecedentMessage;
        }

        return prompts.reverse();
    }

    getAttachmentsByType(interaction: Message | ButtonInteraction, contentTypes: Array<ContentType>): Array<Attachment> {
        this.#logger.info('Looking for attachments of the following types on a message:', contentTypes);

        let attachments: Array<Attachment>;

        if (interaction instanceof Message) {
            attachments = Array.from(interaction.attachments, ([name, value]) => ({ name, value })).map(x => x.value);
        } else if (interaction instanceof ButtonInteraction) {
            attachments = Array.from(interaction.message.attachments, ([name, value]) => ({ name, value })).map(x => x.value);
        }

        const matchingAttachments = attachments.filter(attachment =>
            contentTypes.includes(Object.values(ContentType)
                .find(contentTypeValue => contentTypeValue.toString() === attachment.contentType)));

        return matchingAttachments;
    }

    getAudioAttachments(interaction: Message | ButtonInteraction): Array<Attachment> {
        const audioTypes = [
            ContentType.Mp3
        ];

        return this.getAttachmentsByType(interaction, audioTypes);
    }

    getImageAttachments(interaction: Message | ButtonInteraction): Array<Attachment> {
        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png,
            ContentType.WebP
        ];

        return this.getAttachmentsByType(interaction, imageTypes);
    }

    async getAttachedImagesAsBase64(interaction: Message | ButtonInteraction): Promise<string[]> {
        const imageAttachments = this.getImageAttachments(interaction);
        const imagesAsBase64: string[] = [];

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
