import { ILogger } from '../../../ILogger.js';
import { ILlmHost } from '../models/ILlmHost.js';
import { ILlmLifecycleStrategy } from './ILlmLifecycleStrategy.js';
import { LlamaCppPropsResponse } from './models/LlamaCppPropsResponse.js';

export class LlamaCppSingleLifecycleStrategy implements ILlmLifecycleStrategy {
  readonly #host: ILlmHost;
  readonly #model: string;
  readonly #logger: ILogger;
  readonly #visionModels: string[] | undefined;

  constructor(host: ILlmHost, model: string, logger: ILogger, visionModels?: string[]) {
    this.#host = host;
    this.#model = model;
    this.#logger = logger;
    this.#visionModels = visionModels;
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
    return await Promise.resolve(true);
  }

  async isModelLoaded(): Promise<boolean> {
    return await Promise.resolve(false);
  }

  async waitForModelUnload(intervalMs = 1000): Promise<boolean> {
    let attempt = 0;
    while (true) {
      try {
        const response = await fetch(new URL('/props', this.#host.url), {
          headers: this.#headers(false)
        });

        if (response.ok) {
          const payload = await response.json() as LlamaCppPropsResponse;
          if (payload.is_sleeping === true) {
            this.#logger.info(`Model ${this.#model} is sleeping after ${attempt + 1} check(s).`);
            return true;
          }
        }
      } catch (error) {
        this.#logger.error('Failed to query llama.cpp props:', error);
      }

      attempt++;
      this.#logger.info(`Model ${this.#model} still awake; waiting ${intervalMs}ms (attempt ${attempt}).`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  async getContextWindow(): Promise<number | null> {
    const contextWindow: number | null = null;
    return await Promise.resolve(contextWindow);
  }

  async hasVisionCapability(model: string = this.#model): Promise<boolean> {
    return await Promise.resolve(this.#visionModels?.includes(model) ?? false);
  }
}