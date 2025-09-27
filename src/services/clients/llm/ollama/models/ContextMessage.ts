import { Message } from 'ollama';

export interface ContextMessage<T> extends Message {
    channelId: string;
    timestamp: Date;
    data: T;
    userId: string;
}
