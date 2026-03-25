import { Message } from 'discord.js';

export class DiscordMessageExtractor {
    extractPrompt(message: Message): string {
        const messageContent = message.content || '';

        const lastBacktickIndex = messageContent.lastIndexOf('`');

        if (lastBacktickIndex === -1) {
            return '';
        }

        const secondLastBacktickIndex = messageContent.lastIndexOf('`', lastBacktickIndex - 1);

        if (secondLastBacktickIndex === -1) {
            return '';
        }

        return messageContent.substring(secondLastBacktickIndex + 1, lastBacktickIndex);
    }

    getPreviousMessage(message: Message): Promise<Message | null> {
        if (message.reference !== null) {
            return message.fetchReference();
        } else {
            return Promise.resolve(null);
        }
    }
}
