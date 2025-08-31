export interface IChannelableTask {
    taskChannel: string;
    process(): Promise<void>;
    postProcess(): Promise<void>;
}
