import { BaseTask } from './models/BaseTask.js';

export interface ITaskQueue {
  isActive: boolean;
  isChannelActive(channelName: string): boolean;
  add(task: BaseTask<unknown>): void;
}
