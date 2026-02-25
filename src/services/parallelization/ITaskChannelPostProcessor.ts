export interface ITaskChannelPostProcessor {
  postProcess(): Promise<void>;
}
