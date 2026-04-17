import { ChatRequest, ChatResponse, GenerateRequest, GenerateResponse, Message, Ollama } from 'ollama';

import { IHttpExchange } from '../../../../models/IHttpExchange.js';
import { IHttpExchangeWithAttachedData } from '../../../../models/IHttpExchangeWithAttachedData.js';
import { getRandomArrayEntry, getRandomInt } from '../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../ILogger.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { OllamaRole } from './enums/OllamaRole.js';
import { IStructuredRequestData } from './models/IStructuredRequestData.js';

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

    async generate(prompt: string, temperature: number | undefined = undefined): Promise<IHttpExchange<GenerateRequest, GenerateResponse>> {
        const request: GenerateRequest = {
            prompt,
            model: this.#model
        };

        if(temperature !== undefined) {
            request.options = {
                temperature
            };
        }

        this.#logger.info(`Calling Ollama API with the prompt: ${prompt}`);

        try {
            const response = await this.#client.generate({ ...request, stream: false });

            return {
                request,
                response
            };
        } catch (error) {
            this.#logger.error('Failed to send Ollama a message:', error);
            throw new Error(error as string);
        }
    }

    async generateStructured<TOutput>(prompt: string, requestData: IStructuredRequestData): Promise<IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, TOutput>> {
        const request: GenerateRequest = {
            system: requestData.systemPrompt,
            prompt,
            model: this.#model,
            format: requestData.schema
        };

        this.#logger.info(`Calling Ollama API with the prompt: ${prompt}`);

        try {
            const response = await this.#client.generate({ ...request, stream: false });

            return {
                exchange: {
                    request,
                    response,
                },
                data: JSON.parse(response.response) as TOutput
            };
        } catch (error) {
            this.#logger.error('Failed to send Ollama a message:', error);
            throw new Error(error as string);
        }
    }

    async sendMessage(prompt: string, context: Message[]): Promise<IHttpExchangeWithAttachedData<ChatRequest, ChatResponse, Message[]>> {
        const request: ChatRequest = {
            messages: [...context, {
                content: prompt,
                role: OllamaRole.User
            }],
            model: this.#model
        };

        this.#logger.info('Calling Ollama API with the prompt:', prompt);

        if (context.length > 0) {
            this.#logger.info(`A context of ${context.length} message(s) is provided.`);
        }

        try {
            const response = await this.#client.chat({ ...request, stream: false });
            context.push(response.message);

            return {
                exchange: {
                    request,
                    response
                },
                data: context
            };
        } catch(error) {
            this.#logger.error('Failed to send Ollama a message:', error);
            throw new Error(error as string);
        }
    }

    async sendMessageAndGetStream(prompt: string, context: Message[]): Promise<IHttpExchangeWithAttachedData<ChatRequest, AsyncIterable<ChatResponse>, Message[]> | null> {
        const request: ChatRequest = {
            messages: [...context, {
                content: prompt,
                role: OllamaRole.User
            }],
            model: this.#model
        };

        this.#logger.info(`Calling Ollama API with the prompt: ${prompt}`);

        if (context.length > 0) {
            this.#logger.info(`A context of ${context.length} messages is provided.`);
        }

        try {
            const response = await this.#client.chat({ ...request, stream: true });

            return {
                exchange: {
                    request,
                    response
                },
                data: context
            };
        } catch(error) {
            this.#logger.error('An error occurred while sending Ollama a message and retrieving a stream:', error);
            throw new Error(error as string);
        }
    }

    static calculateTokensPerSecond(response: ChatResponse): number {
        return response.eval_count / response.eval_duration * (10 ** 9);
    }

    #selectModel(models: Array<string>): string {
        const model = models[getRandomInt(0, models.length - 1)];

        this.#logger.info(`Selected model: ${model}`);

        return model;
    }
}
