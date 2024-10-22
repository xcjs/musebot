import { Attachment, AttachmentBuilder, ButtonInteraction, Message } from 'discord.js';

import { ContentType } from '../../../enums/ContentType.js';

export interface IReplyService {
    shouldReply(message: Message): boolean;

    reply(
        interaction: Message | ButtonInteraction,
        content: string | null,
        additionalAttachments: Array<AttachmentBuilder>,
        isEdit: boolean
    ): Promise<void>;

    replyWithError(interaction: Message | ButtonInteraction): Promise<void>;

    getAttachmentsByType(interaction: Message | ButtonInteraction, contentTypes: Array<ContentType>): Array<Attachment>;
}
