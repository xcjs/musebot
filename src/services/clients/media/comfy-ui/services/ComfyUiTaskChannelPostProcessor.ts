import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ITaskChannelPostProcessor } from '../../../../parallelization/ITaskChannelPostProcessor.js';
import { ComfyUiClient } from '../ComfyUiClient.js';

export class ComfyUiTaskChannelPostProcessor implements ITaskChannelPostProcessor {
  #comfyUiClient: ComfyUiClient;

  constructor(services: IServiceContainer) {
    this.#comfyUiClient = services.comfyUiClient;
  }

  async postProcess(): Promise<void> {
    await this.#comfyUiClient.free();
  }
}
