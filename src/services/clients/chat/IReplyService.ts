import { Message, ButtonInteraction, AttachmentBuilder } from 'discord.js';

export interface IReplyService {
    shouldReply(message: Message): boolean;

    reply(
        interaction: Message | ButtonInteraction,
        content: string | null,
        additionalAttachments: Array<AttachmentBuilder>,
        isEdit: boolean
    ): Promise<void>;

    replyWithError(interaction: Message | ButtonInteraction): Promise<void>;
}
