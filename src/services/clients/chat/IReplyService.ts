import { Attachment, BaseMessageOptions, ButtonInteraction, Message, MessageReaction, User } from 'discord.js';

import { ContentType } from '../../../enums/ContentType.js';

export interface IReplyService {
    shouldReply(message: Message, reaction: MessageReaction | null): boolean;

    reply(
        interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions,
        isEdit: boolean
    ): Promise<void>;

    getMessageWithoutBotMentions(message: Message): string;

    mention(user: User): string;

    getAllAntecedentPrompts(message: Message): Promise<string[]>;

    replyWithError(interaction: Message | ButtonInteraction): Promise<void>;

    getAttachments(interaction: Message | ButtonInteraction): Attachment[];

    getAttachmentsByType(interaction: Message | ButtonInteraction, contentTypes: ContentType[] | undefined): Attachment[];

    getAudioAttachments(interaction: Message | ButtonInteraction): Attachment[];

    getImageAttachments(interaction: Message | ButtonInteraction): Attachment[];

    getAttachedImagesAsBase64(interaction: Message | ButtonInteraction): Promise<string[]>;
}
