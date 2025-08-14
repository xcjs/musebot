export interface IReplyRenderTask {
    taskChannel: string;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
