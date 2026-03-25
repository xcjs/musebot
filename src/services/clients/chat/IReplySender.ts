import { BaseMessageOptions } from 'discord.js';

export interface IReplySender<InteractionType> {
    reply(interaction: InteractionType, reply: BaseMessageOptions, isEdit: boolean): Promise<void>;

    replyWithError(interaction: InteractionType): Promise<void>;
}
