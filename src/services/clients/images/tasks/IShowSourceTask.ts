export interface IShowSourceTask {
    taskChannel: string;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
