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

    #prompt: string;
    #structuredRequestData: IStructuredRequestData | undefined = undefined;

    #ollamaExchange: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, T>;

    #onSuccess: (payload: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, T>) => void = () => { };

    constructor(services: IServiceContainer, prompt: string, structuredRequestData: IStructuredRequestData | undefined = undefined) {
        super(services);
        this.logger = services.getLogger('OllamaGenerateStructuredTask');

        this.environmentSettings = services.environmentSettings;
        this.ollamaClient = services.ollamaClient;

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
                this.#onSuccess(this.#ollamaExchange);
                break;
        }
    }
}
