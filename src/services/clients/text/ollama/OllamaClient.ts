import { GenerateRequest, GenerateResponse, Ollama } from 'ollama';

import { IHttpExchange } from '../../../../models/IHttpExchange.js';
import { getRandomArrayEntry, getRandomInt } from '../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../ILogger.js';
import { IServiceContainer } from '../../../IServiceContainer.js';

export class OllamaClient {
    #environmentSettings: IEnvironmentSettings;
    #logger: ILogger;

    #host: URL;
    #client: Ollama;
    #model: string;

    get host(): URL {
        return this.#host;
    }

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;

        this.#logger = services.getLogger('OllamaClient');

        const host = getRandomArrayEntry(this.#environmentSettings.ollamaHosts);
        this.#host = host;
        this.#logger.info(`Selected host: ${host}`);

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

        this.#logger.info(`Calling Ollama API with the prompt: ${message}`);

        if(context && context.length) {
            this.#logger.info(`A context value of ${context.join(', ')} is provided.`);
        }

        try {
            const response = await this.#client.generate({ ...request, stream: false });

            return {
                request,
                response
            };
        } catch(error) {
            this.#logger.info(`Failed to send Ollama a message: ${error}`);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            throw new Error(error);
        }
    }

    async sendMessageAndGetStream(message: string, context: Array<number> | null): Promise<IHttpExchange<GenerateRequest, AsyncIterable<GenerateResponse>> | null> {
        const request: GenerateRequest = {
            context,
            model: this.#model,
            prompt: message,
            system: this.#environmentSettings.ollamaSystemPrompt
        };

        this.#logger.info(`Calling Ollama API at with the prompt: ${message}`);

        if(context && context.length) {
            this.#logger.info(`A context value of ${context.join(', ')} is provided.`);
        }

        try {
            const response = await this.#client.generate({ ...request, stream: true });

            return {
                request,
                response
            };
        } catch(error) {
            this.#logger.error(`An error occurred while sending Ollama a message and retrieving a stream: ${error}`);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            throw new Error(error);
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

        this.#logger.info(`Selected model: ${model}`);

        return model;
    }
}
