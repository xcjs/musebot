export interface IIncreaseGuidanceScaleRenderTask {
    taskChannel: string;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
