export interface IMessageReplyTask {
    taskChannel: string;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
