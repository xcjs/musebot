import { ILogger } from '../../../ILogger.js';
import { ILlmHost } from '../models/ILlmHost.js';
import { ILlmLifecycleStrategy } from './ILlmLifecycleStrategy.js';
import { ModelsCatalog } from './ModelsCatalog.js';

export class NullLifecycleStrategy implements ILlmLifecycleStrategy {
  readonly #model: string;
  readonly #logger: ILogger;
  readonly #modelsCatalog: ModelsCatalog;

  constructor(host: ILlmHost, model: string, logger: ILogger) {
    this.#model = model;
    this.#logger = logger;
    this.#modelsCatalog = new ModelsCatalog(`${host.url.href.replace(/\/$/, '')}/models`, host.token);
  }

  async free(): Promise<boolean> {
    return await Promise.resolve(true);
  }

  async isModelLoaded(): Promise<boolean> {
    return await Promise.resolve(false);
  }

  async waitForModelUnload(_intervalMs?: number): Promise<boolean> {
    return await Promise.resolve(true);
  }

  async getContextWindow(): Promise<number | null> {
    try {
      return await this.#modelsCatalog.getContextWindow(this.#model);
    } catch (error) {
      this.#logger.warn('Failed to read the context window from the models catalog:', error);
      return null;
    }
  }

  async hasVisionCapability(model: string = this.#model): Promise<boolean> {
    const modalities = await this.#readInputModalities(model);

    return modalities?.includes('image') ?? false;
  }

  async #readInputModalities(model: string): Promise<string[] | null> {
    try {
      return await this.#modelsCatalog.inputModalities(model);
    } catch (error) {
      this.#logger.warn('Failed to read the input modalities from the models catalog:', error);
      return null;
    }
  }
}