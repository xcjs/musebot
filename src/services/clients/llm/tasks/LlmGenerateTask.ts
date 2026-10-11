import { IHttpExchange } from '../../../../models/IHttpExchange.js';
import { IBotServiceContainer } from "../../../IBotServiceContainer.js"
import { TaskStatus } from '../../../tasks/enums/TaskStatus.js';
import { ILlmRequest } from '../models/ILlmRequest.js';
import { LlmGenerateResult } from '../models/LlmGenerateResult.js';
import { LlmBaseTask } from './LlmBaseTask.js';

export class LlmGenerateTask extends LlmBaseTask<IHttpExchange<ILlmRequest, LlmGenerateResult>> {
  readonly #prompt: string;
  readonly #temperature: number | undefined = undefined;

  #llmExchange: IHttpExchange<ILlmRequest, LlmGenerateResult> | null = null;

  constructor(services: IBotServiceContainer, prompt: string, temperature: number | undefined = undefined) {
    super(services);
    this.logger = services.getLogger('LlmGenerateTask');

    this.#prompt = prompt;
    this.#temperature = temperature;
  }

  override async process(): Promise<void> {
    this.logger.info(`Starting task with prompt: ${this.#prompt}`);
    this.#llmExchange = await this.llmClient.generate(this.#prompt, this.#temperature);
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