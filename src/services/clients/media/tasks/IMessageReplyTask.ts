export interface IPromptReplyTask {
    taskChannel: string;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
