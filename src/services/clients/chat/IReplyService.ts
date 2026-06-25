import { BaseMessageOptions, User } from 'discord.js';

import { ContentType } from '../../../enums/ContentType.js';

export interface IReplyService<
    MessageType,
    ReactionType,
    AttachmentType,
    InteractionType
> {
    shouldReply(message: MessageType, reaction: ReactionType | null): boolean;

    reply(
        interaction: InteractionType,
        reply: BaseMessageOptions,
        isEdit: boolean
    ): Promise<void>;

    getMessageWithoutBotMentions(message: MessageType): string;

    mention(user: User): string;

    getPreviousMessage(message: MessageType): Promise<MessageType | null>;

    extractPrompt(message: MessageType): string;

    replyWithError(interaction: InteractionType): Promise<void>;

    getAttachments(interaction: InteractionType): AttachmentType[];

    getAttachmentsByType(interaction: InteractionType, contentTypes: ContentType[] | undefined): AttachmentType[];

    getAudioAttachments(interaction: InteractionType): AttachmentType[];

    getImageAttachments(interaction: InteractionType): AttachmentType[];

    getMediaAttachments(interaction: InteractionType): AttachmentType[];

    getJsonAttachments(interaction: InteractionType): AttachmentType[];

    getAttachmentsByName(interaction: InteractionType, name: string): AttachmentType[];

    getAttachedImagesAsBase64(interaction: InteractionType): Promise<string[]>;
}
