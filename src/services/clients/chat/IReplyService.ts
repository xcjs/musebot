import { Attachment, AttachmentBuilder, ButtonInteraction, Message, User } from 'discord.js';

import { ContentType } from '../../../enums/ContentType.js';

export interface IReplyService {
    shouldReply(message: Message, isReaction: boolean): boolean;

    reply(
        interaction: Message | ButtonInteraction,
        content: string | null,
        attachments: Array<AttachmentBuilder>,
        isEdit: boolean
    ): Promise<void>;

    mention(user: User): string;

    replyWithError(interaction: Message | ButtonInteraction): Promise<void>;

    getAttachmentsByType(interaction: Message | ButtonInteraction, contentTypes: Array<ContentType>): Array<Attachment>;

    getAttachedImagesAsBase64(interaction: Message | ButtonInteraction): Promise<Array<string>>;
}
