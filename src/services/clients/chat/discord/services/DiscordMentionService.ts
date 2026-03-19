import { User } from 'discord.js';

import { IMentionService } from '../../IMentionService.js';

export class DiscordMentionService implements IMentionService<User> {
    mention(user: User | null | undefined): string {
        if(user === null || user === undefined) {
            return '';
        }

        return `<@${user.id}>`;
    }

    getMessageWithoutBotMentions(message: string, botMention: string, botRoleMention: string): string {
        let messageContent = message;

        messageContent = messageContent.replaceAll(botMention, '').trim();
        messageContent = messageContent.replaceAll(botRoleMention, '').trim();

        return messageContent;
    }
}
