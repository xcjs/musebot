import { ILogger } from '../../../ILogger.js';
import { ILlmHost } from '../models/ILlmHost.js';
import { ILlmLifecycleStrategy } from './ILlmLifecycleStrategy.js';
import { OllamaPsResponse } from './models/OllamaPsResponse.js';
import { OllamaShowResponse } from './models/OllamaShowResponse.js';

export class OllamaLifecycleStrategy implements ILlmLifecycleStrategy {
  readonly #host: ILlmHost;
  readonly #model: string;
  readonly #logger: ILogger;
  readonly #intervalMs: number;

  constructor(host: ILlmHost, model: string, logger: ILogger, intervalMs: number) {
    this.#host = host;
    this.#model = model;
    this.#logger = logger;
    this.#intervalMs = intervalMs;
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
      const response = await fetch(new URL('/api/generate', this.#host.url), {
        method: 'POST',
        headers: this.#headers(true),
        body: JSON.stringify({ model: this.#model, keep_alive: 0 })
      });

      return response.ok;
    } catch (error) {
      this.#logger.error('Failed to free Ollama resources:', error);
      return false;
    }
  }

  async isModelLoaded(): Promise<boolean> {
    try {
      const response = await fetch(new URL('/api/ps', this.#host.url), {
        headers: this.#headers(false)
      });
      if (!response.ok) {
        return false;
      }

      const payload = await response.json() as OllamaPsResponse;
      return payload.models?.some(m => m.name === this.#model || m.model === this.#model) ?? false;
    } catch {
      return false;
    }
  }

  async waitForModelUnload(intervalMs = this.#intervalMs): Promise<boolean> {
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
      const response = await fetch(new URL('/api/show', this.#host.url), {
        method: 'POST',
        headers: this.#headers(true),
        body: JSON.stringify({ model: this.#model })
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json() as OllamaShowResponse;

      for (const [key, value] of Object.entries(payload.model_info ?? {})) {
        if (key.endsWith('.context_length')) {
          return value as number;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async hasVisionCapability(model: string = this.#model): Promise<boolean> {
    try {
      const response = await fetch(new URL('/api/show', this.#host.url), {
        method: 'POST',
        headers: this.#headers(true),
        body: JSON.stringify({ model })
      });

      if (!response.ok) {
        return false;
      }

      const payload = await response.json() as OllamaShowResponse;
      return payload.capabilities?.includes('vision') ?? false;
    } catch {
      return false;
    }
  }
}