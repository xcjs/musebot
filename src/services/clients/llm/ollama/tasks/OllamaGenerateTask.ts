import { GenerateRequest, GenerateResponse } from 'ollama';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { OllamaClient } from '../OllamaClient.js';

export class OllamaGenerateTask extends BaseTask<IHttpExchange<GenerateRequest, GenerateResponse>> {
    override get taskChannel(): string {
        return `${this.#environmentSettings.ollamaTaskChannel}_${this.#ollamaClient.host}`;
    }

    override set onSuccess(callback: (payload: IHttpExchange<GenerateRequest, GenerateResponse>) => void) {
        this.#onSuccess = callback;
    }

    #environmentSettings: IEnvironmentSettings;
    #ollamaClient: OllamaClient;

    #onSuccess: (payload: IHttpExchange<GenerateRequest, GenerateResponse>) => void = () => { };
    #prompt: string;

    #ollamaExchange: IHttpExchange<GenerateRequest, GenerateResponse>;

    constructor(services: IServiceContainer, prompt: string) {
        super(services);
        this.logger = services.getLogger('OllamaGenerateTask');

        this.#environmentSettings = services.environmentSettings;
        this.#ollamaClient = services.ollamaClient;

        this.#prompt = prompt;
    }

    override async process(): Promise<void> {
        this.logger.info('Starting task with prompt:', this.#prompt);
        this.#ollamaExchange = await this.#ollamaClient.generate(this.#prompt);
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
