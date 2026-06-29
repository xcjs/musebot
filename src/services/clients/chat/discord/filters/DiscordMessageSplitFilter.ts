import { splitText } from '../../../../../utilities/string-utilities.js';
import { IChatMessage } from '../../IChatMessage.js';
import { IOutputChatMessageFilter } from '../../IOutputChatMessageFilter.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class DiscordMessageSplitFilter implements IOutputChatMessageFilter {
    process(messages: IChatMessage[]): Promise<IChatMessage[]> {
        const combined = messages.map(m => m.content).join('');
        const chunks = splitText(combined, DiscordConstants.ContentMaxLength);

        const attachments = messages.flatMap(m => m.attachments);

        const result = chunks.map((content, i) => ({
            content,
            attachments: i === chunks.length - 1 ? attachments : []
        }));

        return Promise.resolve(result);
    }

    async processStreaming(messages: IChatMessage[], _isDone: boolean): Promise<IChatMessage[]> {
        return await this.process(messages);
    }
}