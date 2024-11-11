export interface IEmojiResponseTask {
    taskChannel: string;
    process(): Promise<void>;
}
