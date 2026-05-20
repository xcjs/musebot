import { ILogger } from '../../../../ILogger.js';
import { IBotServiceContainer } from '../../../../IServiceContainer.js';
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

    try {
      await this.#ollamaClient.free();
    } catch (error) {
      this.#logger.error('An error occurred while instructing Ollama to free memory:', error);
    }
  }
}
