import { Logger, LogLevel } from 'meklog';
import { GenerateRequest, GenerateResponse, Ollama } from 'ollama';
//import { AbortableAsyncIterator } from '../../../../node_modules/ollama/src/utils';

import { EnvironmentSettings } from '../../EnvironmentSettings.js';
import { getRandomInt } from '../../../utilities/random-utilities.js';
import { IHttpExchange } from '../../../models/IHttpExchange.js';

export class OllamaClient {
    #environmentSettings: EnvironmentSettings;

    #logger;
    #client: Ollama;

    #host: URL;
    #model: string;

    #isBusy = true;

    get isBusy() {
        return this.#isBusy;
    }

    constructor(environmentSettings: EnvironmentSettings) {
        this.#environmentSettings = environmentSettings;

        this.#logger = Logger(this.#environmentSettings.isProduction, 'OllamaClient');

        const host = this.#selectHost(this.#environmentSettings.ollamaHosts);

        if(host === null) {
            throw new Error('At least one Ollama host must be provided.');
        }

        this.#host = host;
        this.#client = new Ollama({
            host: host.toString(),
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

        this.#logger(LogLevel.Info, `Calling Ollama API at ${this.#host} with the prompt: ${message}.`);

        if(context && context.length) {
            this.#logger(LogLevel.Info, `A context value of ${context.join(', ')} is provided.`);
        }

        try {
            this.#isBusy = true;
            const response = await this.#client.generate({ ...request, stream: false });
            this.#isBusy = false;

            return {
                request,
                response
            };
        } catch(error) {
            this.#logger(LogLevel.Info, error);
            this.#isBusy = false;
            return null;
        }
    }

    async sendMessageAndGetStream(message: string, context: Array<number> | null): Promise<IHttpExchange<GenerateRequest, AsyncIterable<GenerateResponse>> | null> {
        const request: GenerateRequest = {
            context,
            model: this.#model,
            prompt: message,
            system: this.#environmentSettings.ollamaSystemPrompt
        };

        this.#logger(LogLevel.Info, `Calling Ollama API at ${this.#host} with the prompt: ${message}.`);

        if(context && context.length) {
            this.#logger(LogLevel.Info, `A context value of ${context.join(', ')} is provided.`);
        }

        try {
            this.#isBusy = true;
            const response = await this.#client.generate({ ...request, stream: true });
            this.#isBusy = false;

            return {
                request,
                response
            };
        } catch(error) {
            this.#logger(LogLevel.Info, error);
            this.#isBusy = false;
            return null;
        }
    }

    static calculateTokensPerSecond(response: GenerateResponse): number {
        return response.eval_count / response.eval_duration * (10 ** 9);
    }

    #selectHost(hosts: Array<URL>) {
        const host = hosts[getRandomInt(0, hosts.length - 1)];

        this.#logger(LogLevel.Info, `Selected host: ${host}`);

        return host;
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
