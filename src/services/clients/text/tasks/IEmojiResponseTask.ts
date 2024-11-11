export interface IEmojiResponseTask {
    onSuccess: (context: number[]) => void;
    taskChannel: string;
    process(): Promise<void>;
}
