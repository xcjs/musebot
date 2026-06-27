import { IChatMessage } from '../../IChatMessage.js';
import { IChatMessageFilter } from '../../IChatMessageFilter.js';

const MAX_ATTACHMENTS = 10;

export class DiscordAttachmentFilter implements IChatMessageFilter {
    process(messages: IChatMessage[]): Promise<IChatMessage[]> {
        if (messages.length === 0) {
            return Promise.resolve(messages);
        }

        const allAttachments = messages.flatMap(m => m.attachments);
        const attachments = allAttachments.slice(0, MAX_ATTACHMENTS);

        const result = messages.map((message, i) => ({
            content: message.content,
            attachments: i === messages.length - 1 ? attachments : []
        }));

        return Promise.resolve(result);
    }

    async processStreaming(messages: IChatMessage[], _isDone: boolean): Promise<IChatMessage[]> {
        return await this.process(messages);
    }
}