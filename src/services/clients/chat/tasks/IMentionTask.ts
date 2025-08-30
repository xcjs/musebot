export interface IMentionTask {
    taskChannel: string;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
