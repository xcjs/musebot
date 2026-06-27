import { IChatMessage } from './IChatMessage.js';

export interface IChatMessageFactory<T> {
    createMessages(target: T, messages: IChatMessage[]): Promise<T[]>;
    updateMessages(target: T, messages: T[], chatMessages: IChatMessage[]): Promise<T[]>;
}