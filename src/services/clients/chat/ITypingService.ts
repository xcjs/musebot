import { Message, ButtonInteraction } from 'discord.js';

export interface ITypingService {
    startTyping(message: Message | ButtonInteraction): Promise<void>;
}
