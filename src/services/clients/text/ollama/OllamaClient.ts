import { ChatRequest, ChatResponse, Message, Ollama } from 'ollama';

import { IHttpExchangeWithAttachedData } from '../../../../models/IHttpExchangeWithAttachedData.js';
import { getRandomArrayEntry, getRandomInt } from '../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../ILogger.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { OllamaRole } from './enums/OllamaRole.js';

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

    async sendMessage(prompt: string, context: Message[], outOfContext: boolean = false): Promise<IHttpExchangeWithAttachedData<ChatRequest, ChatResponse, Message[]>> {
        const messages = this.#buildChatContext(prompt, context);

        const request: ChatRequest = {
            messages,
            model: this.#model
        };

        this.#logger.info(`Calling Ollama API with the prompt: ${prompt}`);

        if (context.length > 0) {
            this.#logger.info(`A context of ${context.length} messages is provided.`);
        }

        try {
            const response = await this.#client.chat({ ...request, stream: false });

            if(!outOfContext) {
                messages.push(response.message);
            }

            return {
                exchange: {
                    request,
                    response
                },
                data: messages
            };
        } catch(error) {
            this.#logger.error(`Failed to send Ollama a message: ${error}`);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            throw new Error(error);
        }
    }

    async sendMessageAndGetStream(prompt: string, context: Message[]): Promise<IHttpExchangeWithAttachedData<ChatRequest, AsyncIterable<ChatResponse>, Message[]> | null> {
        const messages = this.#buildChatContext(prompt, context);

        const request: ChatRequest = {
            messages,
            model: this.#model
        };

        this.#logger.info(`Calling Ollama API at with the prompt: ${prompt}`);

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
                data: messages
            };
        } catch(error) {
            this.#logger.error(`An error occurred while sending Ollama a message and retrieving a stream: ${error}`);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            throw new Error(error);
        }
    }

    static calculateTokensPerSecond(response: ChatResponse): number {
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

    #buildChatContext(prompt: string, context: Message[]): Message[] {
        let chatMessages: Message[] = [];

        if (!context.find(x => x.role === OllamaRole.System.toString())) {
            chatMessages.push({
                role: OllamaRole.System.toString(),
                content: this.#environmentSettings.ollamaSystemPrompt,
            });
        }

        chatMessages = chatMessages.concat(context);

        chatMessages.push({
            role: OllamaRole.User.toString(),
            content: prompt
        });

        return chatMessages;
    }
}
