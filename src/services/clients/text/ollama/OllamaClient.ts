import { Logger, LogLevel } from 'meklog';
import { GenerateRequest, GenerateResponse, Ollama } from 'ollama';

import { getRandomArrayEntry, getRandomInt } from 'utilities/random-utilities.js';
import { IHttpExchange } from 'models/IHttpExchange.js';
import { IServiceContainer } from 'services/IServiceContainer.js';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings.js';

export class OllamaClient {
    #environmentSettings: IEnvironmentSettings;

    #host: URL;
    #client: Ollama;
    #model: string;

    #logger;

    get host(): URL {
        return this.#host;
    }

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;

        this.#logger = Logger(this.#environmentSettings.isProduction, 'OllamaClient');

        const host = getRandomArrayEntry(this.#environmentSettings.ollamaHosts);
        this.#host = host;
        this.#logger(LogLevel.Info, `Selected host: ${host}`);

        this.#client = new Ollama({
            host: host.toString()
        });

        this.#model = this.#selectModel(this.#environmentSettings.ollamaModels);
    }

    async sendMessage(message: string, context: Array<number> | null): Promise<IHttpExchange<GenerateRequest, GenerateResponse | null>> {
        const request: GenerateRequest = {
            context,
            model: this.#model,
            prompt: message,
            system: this.#environmentSettings.ollamaSystemPrompt
        };

        this.#logger(LogLevel.Info, `Calling Ollama API with the prompt: ${message}`);

        if(context && context.length) {
            this.#logger(LogLevel.Info, `A context value of ${context.join(', ')} is provided.`);
        }

        try {
            const response = await this.#client.generate({ ...request, stream: false });

            return {
                request,
                response
            };
        } catch(error) {
            this.#logger(LogLevel.Info, error);
            throw error;
        }
    }

    async sendMessageAndGetStream(message: string, context: Array<number> | null): Promise<IHttpExchange<GenerateRequest, AsyncIterable<GenerateResponse>> | null> {
        const request: GenerateRequest = {
            context,
            model: this.#model,
            prompt: message,
            system: this.#environmentSettings.ollamaSystemPrompt
        };

        this.#logger(LogLevel.Info, `Calling Ollama API at with the prompt: ${message}.`);

        if(context && context.length) {
            this.#logger(LogLevel.Info, `A context value of ${context.join(', ')} is provided.`);
        }

        try {
            const response = await this.#client.generate({ ...request, stream: true });

            return {
                request,
                response
            };
        } catch(error) {
            this.#logger(LogLevel.Info, error);
            throw error;
        }
    }

    static calculateTokensPerSecond(response: GenerateResponse): number {
        return response.eval_count / response.eval_duration * (10 ** 9);
    }

    #selectModel(models: Array<string>): string | null {
        if(models.length === 0) {
            return null;
        }

        const model = models[getRandomInt(0, models.length - 1)];

        this.#logger(LogLevel.Info, `Selected model: ${model}`);

        return model;
    }
}
