import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ILogger } from '../../../../ILogger.js';
import { ITaskChannelPostProcessor } from '../../../../parallelization/ITaskChannelPostProcessor.js';
import { ComfyUiClient } from '../ComfyUiClient.js';

export class ComfyUiTaskChannelPostProcessor implements ITaskChannelPostProcessor {
  readonly #comfyUiClient: ComfyUiClient;

  readonly #logger: ILogger;

  constructor(services: IBotServiceContainer) {
    this.#comfyUiClient = services.comfyUiClient;

    this.#logger = services.getLogger('ComfyUiTaskChannelPostProcessor');
  }

  async postProcess(): Promise<void> {
    this.#logger.info('Freeing ComfyUI memory.');

    const freed = await this.#comfyUiClient.free();
    if (!freed) {
      this.#logger.warn('ComfyUI VRAM could not be freed during post-process.');
    }
  }
}
