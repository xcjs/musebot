import { GenerateRequest, GenerateResponse } from 'ollama';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { OllamaBaseTask } from './OllamaBaseTask.js';

export class OllamaGenerateTask extends OllamaBaseTask<IHttpExchange<GenerateRequest, GenerateResponse>> {
  readonly #prompt: string;
  readonly #temperature: number | undefined = undefined;

  #ollamaExchange: IHttpExchange<GenerateRequest, GenerateResponse> | null = null;

  constructor(services: IBotServiceContainer, prompt: string, temperature: number | undefined = undefined) {
    super(services);
    this.logger = services.getLogger('OllamaGenerateTask');

    this.#prompt = prompt;
    this.#temperature = temperature;
  }

  override async process(): Promise<void> {
    this.logger.info('Starting task with prompt:', this.#prompt);
    this.#ollamaExchange = await this.ollamaClient.generate(this.#prompt, this.#temperature);
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
