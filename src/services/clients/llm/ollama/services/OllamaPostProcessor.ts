import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ITaskChannelPostProcessor } from '../../../../parallelization/ITaskChannelPostProcessor.js';
import { OllamaClient } from '../OllamaClient.js';

export class OllamaPostProcessor implements ITaskChannelPostProcessor {
  #ollamaClient: OllamaClient;

  constructor(services: IServiceContainer) {
    this.#ollamaClient = services.ollamaClient;
  }

  async postProcess(): Promise<void> {
    await this.#ollamaClient.free();
  }
}
