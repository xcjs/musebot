import { ChatRequest, ChatResponse, GenerateRequest, GenerateResponse, Message, Ollama, ShowResponse } from 'ollama';

import { IHttpExchange } from '../../../../models/IHttpExchange.js';
import { IHttpExchangeWithAttachedData } from '../../../../models/IHttpExchangeWithAttachedData.js';
import { getRandomArrayEntry, getRandomInt } from '../../../../utilities/random-utilities.js';
import { trimTrailingJsonContent } from '../../../../utilities/string-utilities.js';
import { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { ILogger } from '../../../ILogger.js';
import { OllamaRole } from './enums/OllamaRole.js';
import { IStructuredRequestData } from './models/IStructuredRequestData.js';

export class OllamaClient {
    readonly #configurationService: IConfigurationService;
    readonly #logger: ILogger;

    readonly #host: URL;
    readonly #client: Ollama;
    readonly #model: string;

    get host(): URL {
        return this.#host;
    }

    constructor(services: IBotServiceContainer) {
        this.#configurationService = services.configurationService;

        this.#logger = services.getLogger('OllamaClient');

        const host = getRandomArrayEntry(this.#configurationService.ollamaHosts);

        if (!host) {
            throw new Error('No Ollama hosts configured in environment settings.');
        }

        this.#host = host;
        this.#logger.info(`Selected host: ${host}`);

        this.#client = new Ollama({
            host: host.toString()
        });

        this.#model = this.#selectModel(this.#configurationService.ollamaModels);
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

    async free(): Promise<boolean> {
        try {
            await this.#client.generate({
                prompt: null!,
                model: this.#model,
                stream: false,
                keep_alive: 0
            });

            return true;
        } catch (error) {
            this.#logger.error('Failed to free Ollama resources:', error);
            return false;
        }
    }

    async isModelLoaded(): Promise<boolean> {
        const running = await this.#client.ps();
        return running.models?.some(m => m.name === this.#model || m.model === this.#model) ?? false;
    }

    async show(model: string = this.#model): Promise<ShowResponse> {
        try {
            return await this.#client.show({ model });
        } catch (error) {
            this.#logger.error(`Failed to query Ollama for model details for '${model}':`, error);
            throw new Error(error as string);
        }
    }

    async hasVisionCapability(model: string = this.#model): Promise<boolean> {
        try {
            const response = await this.show(model);
            return response.capabilities?.includes('vision') ?? false;
        } catch {
            return false;
        }
    }

    async waitForModelUnload(intervalMs = this.#configurationService.taskRetryDelayMilliseconds): Promise<boolean> {
        const freed = await this.free();
        if (!freed) {
            return false;
        }

        let attempt = 0;
        while (true) {
            const loaded = await this.isModelLoaded();
            if (!loaded) {
                this.#logger.info(`Model ${this.#model} unloaded after ${attempt + 1} check(s).`);
                return true;
            }

            attempt++;
            this.#logger.info(`Model ${this.#model} still loaded; waiting ${intervalMs}ms (attempt ${attempt}).`);
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }

    async generateStructured<TOutput>(prompt: string, requestData: IStructuredRequestData):
        Promise<IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, TOutput>>
    {

        const request: GenerateRequest = {
            system: requestData.systemPrompt,
            prompt,
            model: this.#model,
            stream: false,
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
                // Some models place structured outputs in the reasoning (thinking) property
                // instead of the main response body, so we check it first and fall back to the
                // response property when reasoning is absent.
                data: JSON.parse(trimTrailingJsonContent(response.thinking ?? response.response)) as TOutput
            };
        } catch (error) {
            this.#logger.error('Failed to send Ollama a message:', error);
            throw new Error(error as string);
        }
    }

    async sendMessage(prompt: string, context: Message[], images: string[] = []):
        Promise<IHttpExchangeWithAttachedData<ChatRequest, ChatResponse, Message[]>>
    {
        const userMessage: Message = {
            content: prompt,
            role: OllamaRole.User
        };

        if (images.length > 0) {
            userMessage.images = images;
        }

        const request: ChatRequest = {
            messages: [...context, userMessage],
            model: this.#model
        };

        this.#logger.info('Calling Ollama API with the prompt:', prompt);

        if (context.length > 0) {
            this.#logger.info(`A context of ${context.length} message(s) is provided.`);
        }

        if (images.length > 0) {
            this.#logger.info(`Attaching ${images.length} image(s) to the Ollama request.`);
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

    async sendMessageAndGetStream(prompt: string, context: Message[], images: string[] = []):
        Promise<IHttpExchangeWithAttachedData<ChatRequest, AsyncIterable<ChatResponse>, Message[]> | null>
    {
        const userMessage: Message = {
            content: prompt,
            role: OllamaRole.User
        };

        if (images.length > 0) {
            userMessage.images = images;
        }

        const request: ChatRequest = {
            messages: [...context, userMessage],
            model: this.#model
        };

        this.#logger.info(`Calling Ollama API with the prompt: ${prompt}`);

        if (context.length > 0) {
            this.#logger.info(`A context of ${context.length} messages is provided.`);
        }

        if (images.length > 0) {
            this.#logger.info(`Attaching ${images.length} image(s) to the Ollama request.`);
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

    async embed(input: string): Promise<number[]> {
        const embeddingModel = this.#configurationService.ollamaEmbeddingModel;

        if (!embeddingModel) {
            throw new Error('No embedding model configured.');
        }

        const response = await this.#client.embed({ model: embeddingModel, input });

        return response.embeddings[0];
    }

    async interpretImages(images: string[], contextPrompt: string = ''): Promise<string> {
        if (images.length === 0) {
            return '';
        }

        const prompt = 'You are a visual assistant. Describe what you see in the attached image(s)'
            + ' concisely and factually, as plain text. Focus on subjects, scene, colors, and any visible text.'
            + ' If multiple images are attached, describe each in order.'
            + (contextPrompt.length > 0 ? `\n\nContext for these images:\n${contextPrompt}` : '');

        const request: GenerateRequest = {
            prompt,
            model: this.#model,
            images,
            stream: false
        };

        this.#logger.info(`Calling Ollama API to interpret ${images.length} image(s).`);

        try {
            const response = await this.#client.generate({ ...request, stream: false });
            return response.response.trim();
        } catch (error) {
            this.#logger.error('Failed to interpret image(s) via Ollama:', error);
            throw new Error(error as string);
        }
    }

    #selectModel(models: Array<string>): string {
        const model = models[getRandomInt(0, models.length - 1)];

        this.#logger.info(`Selected model: ${model}`);

        return model;
    }
}
