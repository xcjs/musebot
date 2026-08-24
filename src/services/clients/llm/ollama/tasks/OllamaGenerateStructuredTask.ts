import { GenerateRequest, GenerateResponse } from 'ollama';

import { IHttpExchangeWithAttachedData } from '../../../../../models/IHttpExchangeWithAttachedData.js';
import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { IStructuredRequestData } from '../models/IStructuredRequestData.js';
import { OllamaBaseTask } from './OllamaBaseTask.js';

export class OllamaGenerateStructuredTask<T> extends OllamaBaseTask<IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, T>> {
  readonly #prompt: string;
  readonly #structuredRequestData: IStructuredRequestData;

  #ollamaExchange: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, T> | null = null;

  constructor(services: IBotServiceContainer, prompt: string, structuredRequestData: IStructuredRequestData) {
    super(services);
    this.logger = services.getLogger('OllamaGenerateStructuredTask');

    this.#prompt = prompt;
    this.#structuredRequestData = structuredRequestData;
  }

  override async process(): Promise<void> {
    this.logger.info('Starting task with prompt:', this.#prompt);
    this.#ollamaExchange = await this.ollamaClient.generateStructured<T>(this.#prompt, this.#structuredRequestData);
  }

  override async postProcess(): Promise<void> {
    await super.postProcess();

    switch (this.taskStatus) {
      case TaskStatus.Successful:
        this.logger.success('Task successful - passing Ollama exchange to callback:', this.#ollamaExchange);

        if(this.#ollamaExchange !== null) {
          this.invokeOnSuccess(this.#ollamaExchange);
        }

        break;

      case TaskStatus.Dead:
        this.logger.error('Task dead - invoking onFailure callback.');

        this.invokeOnFailure(this.lastError ?? new Error('Task died without a captured error.'));

        break;
    }
  }
}
