import { Attachment, BaseMessageOptions, ButtonInteraction, Message, User } from 'discord.js';

import { ContentType } from '../../../enums/ContentType.js';

export interface IReplyService {
    shouldReply(message: Message, isReaction: boolean): boolean;

    reply(
        interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions,
        bypassEdit: boolean
    ): Promise<void>;

    getMessageWithoutBotMentions(message: Message): string;

    mention(user: User): string;

    replyWithError(interaction: Message | ButtonInteraction): Promise<void>;

    getAttachmentsByType(interaction: Message | ButtonInteraction, contentTypes: Array<ContentType>): Array<Attachment>;

    getImageAttachments(interaction: Message | ButtonInteraction): Array<Attachment>;

    getAttachedImagesAsBase64(interaction: Message | ButtonInteraction): Promise<Array<string>>;
}
