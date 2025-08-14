import { Message } from 'ollama';

export interface IPromptResponseTask {
    taskChannel: string;
    onSuccess: (context: Message[]) => void;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
