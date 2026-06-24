import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ILogger } from '../../../../ILogger.js';
import { ITaskChannelPostProcessor } from '../../../../parallelization/ITaskChannelPostProcessor.js';
import { OllamaClient } from '../../ollama/OllamaClient.js';

export class OllamaTaskChannelPostProcessor implements ITaskChannelPostProcessor {
  readonly #ollamaClient: OllamaClient;

  readonly #logger: ILogger;

  constructor(services: IBotServiceContainer) {
    this.#ollamaClient = services.ollamaClient;

    this.#logger = services.getLogger('OllamaTaskChannelPostProcessor');
  }

  async postProcess(): Promise<void> {
    this.#logger.info('Freeing Ollama memory.');

    const freed = await this.#ollamaClient.free();
    if (!freed) {
      this.#logger.warn('Ollama model could not be unloaded during post-process.');
    }
  }
}
