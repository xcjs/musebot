import { ITaskChannelPostProcessor } from './ITaskChannelPostProcessor.js';

export class NoOpTaskChannelPostProcessor implements ITaskChannelPostProcessor {
  constructor() {

  }

  async postProcess(): Promise<void> {
    return await Promise.resolve();
  }
}
