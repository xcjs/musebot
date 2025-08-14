export interface IJsonRenderTask {
    taskChannel: string;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
