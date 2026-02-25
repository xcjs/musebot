import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ITaskChannelPostProcessor } from '../../../../parallelization/ITaskChannelPostProcessor.js';
import { ComfyUiClient } from '../ComfyUiClient.js';

export class ComfyUiTaskChannelPostProcessor implements ITaskChannelPostProcessor {
  #comfyUiClient: ComfyUiClient;

  #logger: ILogger;

  constructor(services: IServiceContainer) {
    this.#comfyUiClient = services.comfyUiClient;

    this.#logger = services.getLogger('ComfyUiTaskChannelPostProcessor');
  }

  async postProcess(): Promise<void> {
    try {
      await this.#comfyUiClient.free();
    } catch (error) {
      this.#logger.error('An error occurred while instructing ComfyUI to free memory:', error);
    }
  }
}
