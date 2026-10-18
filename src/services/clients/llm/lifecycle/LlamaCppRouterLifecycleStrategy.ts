import { ILogger } from '../../../ILogger.js';
import { ILlmHost } from '../models/ILlmHost.js';
import { ILlmLifecycleStrategy } from './ILlmLifecycleStrategy.js';
import { LlamaCppModelsResponse } from './models/LlamaCppModelsResponse.js';
import { LlamaCppModelStatus } from './models/LlamaCppModelStatus.js';
import { ModelsCatalog } from './ModelsCatalog.js';

export class LlamaCppRouterLifecycleStrategy implements ILlmLifecycleStrategy {
  readonly #host: ILlmHost;
  readonly #model: string;
  readonly #logger: ILogger;
  readonly #modelsCatalog: ModelsCatalog;

  constructor(host: ILlmHost, model: string, logger: ILogger) {
    this.#host = host;
    this.#model = model;
    this.#logger = logger;
    this.#modelsCatalog = new ModelsCatalog(new URL('/models', host.url).href, host.token);
  }

  #headers(json: boolean): Record<string, string> {
    const headers: Record<string, string> = {};
    if (json) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.#host.token !== null) {
      headers['Authorization'] = `Bearer ${this.#host.token}`;
    }
    return headers;
  }

  async free(): Promise<boolean> {
    try {
      const response = await fetch(new URL('/models/unload', this.#host.url), {
        method: 'POST',
        headers: this.#headers(true),
        body: JSON.stringify({ model: this.#model })
      });

      return response.ok;
    } catch (error) {
      this.#logger.error('Failed to free llama.cpp router resources:', error);
      return false;
    }
  }

  async isModelLoaded(): Promise<boolean> {
    try {
      const response = await fetch(new URL('/models', this.#host.url), {
        headers: this.#headers(false)
      });
      if (!response.ok) {
        return false;
      }

      const payload = await response.json() as LlamaCppModelsResponse;
      const entries = (payload.models ?? payload.data ?? []) as Array<{ model?: string; id?: string; status?: LlamaCppModelStatus }>;

      return entries.some(m => (m.model ?? m.id) === this.#model
        && (m.status?.value === 'loaded' || m.status?.value === 'loading'));
    } catch {
      return false;
    }
  }

  async waitForModelUnload(intervalMs = 1000): Promise<boolean> {
    const freed = await this.free();
    if (!freed) {
      return false;
    }

    let attempt = 0;
    while (true) {
      const loaded = await this.isModelLoaded();
      if (!loaded) {
        this.#logger.info(`Model ${this.#model} unloaded after ${attempt + 1} check(s).`);
        return true;
      }

      attempt++;
      this.#logger.info(`Model ${this.#model} still loaded; waiting ${intervalMs}ms (attempt ${attempt}).`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  async getContextWindow(): Promise<number | null> {
    try {
      return await this.#modelsCatalog.getContextWindow(this.#model);
    } catch (error) {
      this.#logger.error('Failed to read the context window from the models catalog:', error);
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
      this.#logger.error('Failed to read the input modalities from the models catalog:', error);
      return null;
    }
  }
}