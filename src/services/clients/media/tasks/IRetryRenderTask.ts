export interface IRetryRenderTask {
    taskChannel: string;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
