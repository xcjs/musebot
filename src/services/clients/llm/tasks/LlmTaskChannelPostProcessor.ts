import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { ILogger } from '../../../ILogger.js';
import { ITaskChannelPostProcessor } from '../../../parallelization/ITaskChannelPostProcessor.js';
import { ILlmClient } from '../ILlmClient.js';

export class LlmTaskChannelPostProcessor implements ITaskChannelPostProcessor {
  readonly #llmClient: ILlmClient;

  readonly #logger: ILogger;

  constructor(services: IBotServiceContainer) {
    this.#llmClient = services.llmClient;

    this.#logger = services.getLogger('LlmTaskChannelPostProcessor');
  }

  async postProcess(): Promise<void> {
    this.#logger.info('Freeing LLM memory.');

    await this.#llmClient.free();
  }
}