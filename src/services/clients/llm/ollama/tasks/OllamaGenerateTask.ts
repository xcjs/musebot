import { GenerateRequest, GenerateResponse } from 'ollama';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { OllamaBaseTask } from './OllamaBaseTask.js';

export class OllamaGenerateTask extends OllamaBaseTask<IHttpExchange<GenerateRequest, GenerateResponse>> {

    override set onSuccess(callback: (payload: IHttpExchange<GenerateRequest, GenerateResponse>) => void) {
        this.#onSuccess = callback;
    }

    #prompt: string;

    #ollamaExchange: IHttpExchange<GenerateRequest, GenerateResponse>;

    #onSuccess: (payload: IHttpExchange<GenerateRequest, GenerateResponse>) => void = () => { };

    constructor(services: IServiceContainer, prompt: string) {
        super(services);
        this.logger = services.getLogger('OllamaGenerateTask');

        this.environmentSettings = services.environmentSettings;
        this.ollamaClient = services.ollamaClient;

        this.#prompt = prompt;
    }

    override async process(): Promise<void> {
        this.logger.info('Starting task with prompt:', this.#prompt);
        this.#ollamaExchange = await this.ollamaClient.generate(this.#prompt);
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
