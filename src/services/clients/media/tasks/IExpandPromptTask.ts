export interface IExpandPromptTask {
    taskChannel: string;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
