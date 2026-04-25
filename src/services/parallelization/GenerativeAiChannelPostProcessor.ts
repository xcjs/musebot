import { OllamaClient } from '../clients/llm/ollama/OllamaClient.js';
import { ComfyUiClient } from '../clients/media/comfy-ui/ComfyUiClient.js';
import { ILogger } from '../ILogger.js';
import { IServiceContainer } from '../IServiceContainer.js';
import { ITaskChannelPostProcessor } from './ITaskChannelPostProcessor.js';

export class GenerativeAiChannelPostProcessor implements ITaskChannelPostProcessor {
  readonly #ollamaClient: OllamaClient;
  readonly #comfyUiClient: ComfyUiClient;

  readonly #logger: ILogger;

  constructor(services: IServiceContainer) {
    this.#ollamaClient = services.ollamaClient;
    this.#comfyUiClient = services.comfyUiClient;

    this.#logger = services.getLogger('GenerativeAiChannelPostProcessor');
  }

  async postProcess(): Promise<void> {
    this.#logger.info('Running Ollama and ComfyUI post-processors.');

    await this.#comfyUiClient.free();
    await this.#ollamaClient.free();
  }
}
