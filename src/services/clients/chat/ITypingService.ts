import { ButtonInteraction,Message } from 'discord.js';

export interface ITypingService {
    startTyping(message: Message | ButtonInteraction): Promise<void>;
}
