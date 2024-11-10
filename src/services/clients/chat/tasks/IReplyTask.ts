export interface IReplyTask {
    taskChannel: string;
    process(): Promise<void>;
}
