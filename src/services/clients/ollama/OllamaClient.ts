import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../models/EnvironmentSettings.js';
import { GenerateRequest } from './models/GenerateRequest.js';
import { getRandomInt } from '../../../utilities/random-utilities.js';
import { ContentType } from '../../../enums/ContentType.js';
import { HttpMethod } from '../../../enums/HttpMethod.js';
import { HttpHeader } from '../../../enums/HttpHeader.js';
import { GenerateResponse } from './models/GenerateResponse.js';
import { IHttpExchange } from '../../../models/IHttpExchange.js';

export class OllamaClient {
    #environmentSettings: EnvironmentSettings;

    #logger;

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
        this.#model = this.#selectModel(this.#environmentSettings.ollamaModels);
    }

    async sendMessage(message: string, context: Array<number> | null): Promise<IHttpExchange<GenerateRequest, GenerateResponse | null>> {
        const request = new GenerateRequest();

        request.system = this.#environmentSettings.ollamaSystemPrompt;
        request.model = this.#model;
        request.prompt = message;

        if(context) {
            request.context = context;
        }

        this.#isBusy = true;

        try {
            const response = await fetch(new URL('api/generate', this.#host), {
                method: HttpMethod.Post,
                headers: {
                    [HttpHeader.ContentType]: ContentType.Json
                },
                body: JSON.stringify(request)
            });

            this.#isBusy = false;

            return {
                request,
                response: await response.json() as GenerateResponse
            };
        } catch(error) {
            this.#logger(LogLevel.Info, error);
            this.#isBusy = false;
            return null;
        }
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
