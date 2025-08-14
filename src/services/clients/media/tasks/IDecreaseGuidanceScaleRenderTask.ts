export interface IDecreaseGuidanceScaleRenderTask {
    taskChannel: string;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
