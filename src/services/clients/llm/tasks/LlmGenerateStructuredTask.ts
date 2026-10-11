import { IHttpExchangeWithAttachedData } from '../../../../models/IHttpExchangeWithAttachedData.js';
import { IBotServiceContainer } from "../../../IBotServiceContainer.js"
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { ILlmRequest } from '../models/ILlmRequest.js';
import { IStructuredRequestData } from '../models/IStructuredRequestData.js';
import { LlmGenerateResult } from '../models/LlmGenerateResult.js';
import { LlmBaseTask } from './LlmBaseTask.js';

export class LlmGenerateStructuredTask<T> extends LlmBaseTask<IHttpExchangeWithAttachedData<ILlmRequest, LlmGenerateResult, T>> {
  readonly #prompt: string;
  readonly #structuredRequestData: IStructuredRequestData;

  #llmExchange: IHttpExchangeWithAttachedData<ILlmRequest, LlmGenerateResult, T> | null = null;

  constructor(services: IBotServiceContainer, prompt: string, structuredRequestData: IStructuredRequestData) {
    super(services);
    this.logger = services.getLogger('LlmGenerateStructuredTask');

    this.#prompt = prompt;
    this.#structuredRequestData = structuredRequestData;
  }

  override async process(): Promise<void> {
    this.logger.info(`Starting task with prompt: ${this.#prompt}`);
    this.#llmExchange = await this.llmClient.generateStructured<T>(this.#prompt, this.#structuredRequestData);
  }

  override async postProcess(): Promise<void> {
    await super.postProcess();

    switch (this.taskStatus) {
      case TaskStatus.Successful:
        this.logger.success('Task successful - passing LLM exchange to callback:', this.#llmExchange);

        if(this.#llmExchange !== null) {
          this.invokeOnSuccess(this.#llmExchange);
        }

        break;

      case TaskStatus.Dead:
        this.logger.error('Task dead - invoking onFailure callback.');

        this.invokeOnFailure(this.lastError ?? new Error('Task died without a captured error.'));

        break;
    }
  }
}