import { Attachment, BaseMessageOptions, ButtonInteraction, Message, MessageReaction, User } from 'discord.js';

import { ContentType } from '../../../../../enums/ContentType.js';
import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { IReplyService } from '../../IReplyService.js';
import { DiscordAttachmentService } from '../services/DiscordAttachmentService.js';
import { DiscordMentionService } from '../services/DiscordMentionService.js';
import { DiscordMessageExtractor } from '../services/DiscordMessageExtractor.js';
import { DiscordReplyFilter } from './DiscordReplyFilter.js';
import { DiscordReplySender } from './DiscordReplySender.js';

export class DiscordReplyService implements IReplyService<Message, MessageReaction, Attachment, Message | ButtonInteraction> {
    readonly #filter: DiscordReplyFilter;
    readonly #sender: DiscordReplySender;
    readonly #mentionService: DiscordMentionService;
    readonly #extractor: DiscordMessageExtractor;
    readonly #attachmentService: DiscordAttachmentService;

    constructor(services: IBotServiceContainer) {
        this.#filter = new DiscordReplyFilter(services);
        this.#sender = new DiscordReplySender(services);
        this.#mentionService = new DiscordMentionService();
        this.#extractor = new DiscordMessageExtractor();
        this.#attachmentService = new DiscordAttachmentService();
    }

    shouldReply(message: Message, reaction: MessageReaction | null): boolean {
        return this.#filter.shouldReply(message, reaction);
    }

    async reply(
        interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions,
        isEdit: boolean = false
    ): Promise<void> {
        await this.#sender.reply(interaction, reply, isEdit);
    }

    async replyWithError(interaction: Message | ButtonInteraction): Promise<void> {
        return this.#sender.replyWithError(interaction);
    }

    getMessageWithoutBotMentions(message: Message): string {
        const botMention = this.mention(message.client.user) ?? '';
        const botRoleMention = this.#getBotRoleMention(message) ?? '';

        return this.#mentionService.getMessageWithoutBotMentions(message.content, botMention, botRoleMention);
    }

    mention(user: User | null | undefined): string {
        return this.#mentionService.mention(user);
    }

    getPreviousMessage(message: Message): Promise<Message | null> {
        return this.#extractor.getPreviousMessage(message);
    }

    extractPrompt(message: Message): string {
        return this.#extractor.extractPrompt(message);
    }

    getAttachments(interaction: Message | ButtonInteraction): Attachment[] {
        return this.#attachmentService.getAttachments(interaction);
    }

    getAttachmentsByType(
        interaction: Message | ButtonInteraction,
        contentTypes: ContentType[] | undefined
    ): Attachment[] {
        return this.#attachmentService.getAttachmentsByType(interaction, contentTypes ?? []);
    }

    getAudioAttachments(interaction: Message | ButtonInteraction): Attachment[] {
        return this.#attachmentService.getAudioAttachments(interaction);
    }

    getImageAttachments(interaction: Message | ButtonInteraction): Attachment[] {
        return this.#attachmentService.getImageAttachments(interaction);
    }

    getMediaAttachments(interaction: Message | ButtonInteraction): Attachment[] {
        return this.#attachmentService.getMediaAttachments(interaction);
    }

    getJsonAttachments(interaction: Message | ButtonInteraction): Attachment[] {
        return this.#attachmentService.getJsonAttachments(interaction);
    }

    getAttachmentsByName(interaction: Message | ButtonInteraction, name: string): Attachment[] {
        return this.#attachmentService.getAttachmentsByName(interaction, name);
    }

    async getAttachedImagesAsBase64(interaction: Message | ButtonInteraction): Promise<string[]> {
        return this.#attachmentService.getAttachedImagesAsBase64(interaction);
    }

    #getBotRoleMention(message: Message): string | null {
        const botRole = message.guild?.members.resolve(message.client.user)?.roles.botRole || null;
        return message.mentions.roles.find(x => x.id === botRole?.id)?.toString() ?? null;
    }
}
