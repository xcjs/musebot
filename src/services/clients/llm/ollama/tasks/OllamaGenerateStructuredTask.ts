import { GenerateRequest, GenerateResponse } from 'ollama';

import { IHttpExchangeWithAttachedData } from '../../../../../models/IHttpExchangeWithAttachedData.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { IStructuredRequestData } from '../models/IStructuredRequestData.js';
import { OllamaBaseTask } from './OllamaBaseTask.js';

export class OllamaGenerateStructuredTask<T> extends OllamaBaseTask<IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, T>> {

    override set onSuccess(callback: (payload: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, T>) => void) {
        this.#onSuccess = callback;
    }

    readonly #prompt: string;
    readonly #structuredRequestData: IStructuredRequestData;

    #ollamaExchange: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, T> | null = null;

    #onSuccess: (payload: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, T>) => void = () => { };

    constructor(services: IServiceContainer, prompt: string, structuredRequestData: IStructuredRequestData) {
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
                    this.#onSuccess(this.#ollamaExchange);
                }

                break;
        }
    }
}
