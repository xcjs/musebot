export interface IPromptResponseTask {
    taskChannel: string;
    onSuccess: (context: number[]) => void;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
