import { ILogger } from '../../../ILogger.js';
import { ILlmHost } from '../models/ILlmHost.js';
import { ILlmLifecycleStrategy } from './ILlmLifecycleStrategy.js';

export class NullLifecycleStrategy implements ILlmLifecycleStrategy {
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
    const contextWindow: number | null = null;
    return await Promise.resolve(contextWindow);
  }

  async hasVisionCapability(model: string = this.#model): Promise<boolean> {
    return await Promise.resolve(this.#visionModels?.includes(model) ?? false);
  }
}