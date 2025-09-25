import { Message } from 'ollama';

export interface ContextMessage<T> extends Message {
    timestamp: Date;
    user: T;
}
