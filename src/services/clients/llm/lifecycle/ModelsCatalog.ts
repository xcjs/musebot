import { OpenAiModelsEntry } from './models/OpenAiModelsEntry.js';
import { OpenAiModelsResponse } from './models/OpenAiModelsResponse.js';

export class ModelsCatalog {
  readonly #modelsEndpoint: string;
  readonly #token: string | null;

  constructor(modelsEndpoint: string, token: string | null) {
    this.#modelsEndpoint = modelsEndpoint;
    this.#token = token;
  }

  async getContextWindow(model: string): Promise<number | null> {
    const entry = await this.#fetchModelEntry(model);

    const contextLength = entry?.context_length;

    return typeof contextLength === 'number' && Number.isFinite(contextLength) ? contextLength : null;
  }

  async inputModalities(model: string): Promise<string[] | null> {
    const entry = await this.#fetchModelEntry(model);

    const rawModalities = entry?.architecture?.input_modalities;
    if (rawModalities === undefined) {
      return null;
    }

    const modalities = (Array.isArray(rawModalities) ? rawModalities : rawModalities.split(/\s+/))
      .filter(modality => modality.length > 0)
      .map(modality => modality.toLowerCase());

    return modalities.length > 0 ? modalities : null;
  }

  async #fetchModelEntry(model: string): Promise<OpenAiModelsEntry | undefined> {
    const headers: Record<string, string> = {};
    if (this.#token !== null) {
      headers['Authorization'] = `Bearer ${this.#token}`;
    }

    const response = await fetch(this.#modelsEndpoint, { headers });
    if (!response.ok) {
      return undefined;
    }

    const payload = await response.json() as OpenAiModelsResponse;

    return payload.data?.find(entry => entry.id === model);
  }
}