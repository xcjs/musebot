import { Message } from 'ollama';

export interface IEmojiResponseTask {
    onSuccess: (context: Message[]) => void;
    taskChannel: string;
    process(): Promise<void>;
}
