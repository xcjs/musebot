import path from 'node:path';

import {Logger, LogLevel } from 'meklog'

import { ContentType } from '../../../../enums/ContentType.js';
import { HttpHeader } from '../../../../enums/HttpHeader.js';
import { HttpMethod } from '../../../../enums/HttpMethod.js';
import { HttpStatusCode } from '../../../../enums/HttpStatusCode.js';
import { JavaScriptType } from '../../../../enums/JavaScriptType.js';
import { IHttpExchange } from '../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { StreamStatus } from './enums/StreamStatus.js';
import { RenderRequest } from './models/requests/RenderRequest.js';
import { IModelsResponse } from './models/responses/IModelsResponse.js';
import { IRenderResponse } from './models/responses/IRenderResponse.js';
import { IStreamResponse } from './models/responses/IStreamResponse.js';
import { JaggedRecursiveStringArray } from './types/JaggedRecursiveStringArray.js';

export class EasyDiffusionClient {
    #environmentSettings: IEnvironmentSettings;

    #logger;

    #host: URL;

    #retryDelayInMilliseconds = 1000;

    get host(): URL {
        return this.#host;
    }

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;

        this.#logger = Logger(this.#environmentSettings.isProduction, 'EasyDiffusionClient');

        this.#host = getRandomArrayEntry(this.#environmentSettings.stableDiffusionHosts);
        this.#logger(LogLevel.Info, `Selected host: ${this.#host}`);
    }

    async render(renderRequest: RenderRequest): Promise<IHttpExchange<RenderRequest, IRenderResponse>> {
        this.#logger(LogLevel.Info, 'Sending render request to EasyDiffusion...');

        try {
            const response = await fetch(new URL('render', this.#host), {
                method: HttpMethod.Post,
                headers: {
                    [HttpHeader.ContentType]: ContentType.Json
                },
                body: JSON.stringify(renderRequest)
            });

            return {
                request: renderRequest,
                response: await response.json() as IRenderResponse
            };
        } catch(error) {
            this.#logger(LogLevel.Error, `Failed to render an image: ${error}`);
            throw error;
        }
    }

    async stream(renderExchange: IHttpExchange<RenderRequest, IRenderResponse>) : Promise<IStreamResponse> {
        const renderResponse = renderExchange?.response;

        const streamUrl = new URL(renderResponse.stream, this.#host);

        try {
            let response : Response;

            do {
                this.#logger(LogLevel.Info, `Checking response stream at ${renderResponse.stream}`);
                response = await fetch(streamUrl);

                if(response.status === HttpStatusCode.TooEarly) {
                    await this.#sleep(this.#retryDelayInMilliseconds);
                } else if(response.ok) {
                    try {
                        const responseBody = await response.json() as IStreamResponse;

                        if(responseBody.status === StreamStatus.Failed) {
                            return null;
                        } else if(responseBody.status === StreamStatus.Succeeded) {
                            return responseBody;
                        }

                        await this.#sleep(this.#retryDelayInMilliseconds);
                    } catch {
                        // EasyDiffusion incorrectly uses the application/json response type for empty responses.
                        await this.#sleep(this.#retryDelayInMilliseconds);
                    }
                }
                // Keep trying as long as the response status is OK or 425 - Too Early.
            } while (response.ok || response.status === HttpStatusCode.TooEarly);
        } catch (error) {
            this.#logger(LogLevel.Error, `Checking the EasyDiffusion render stream failed: ${error}`);
            throw error;
        }
    }

    async getModels(): Promise<Array<string>> {
        try {
            this.#logger(LogLevel.Info, `Loading Easy Diffusion options...`);
            const response = await fetch(new URL('/get/models?scan_for_malicious=true', this.#host), {
                headers: {
                    [HttpHeader.ContentType]: ContentType.Json
                }
            });

            const modelsResponse = await response.json() as IModelsResponse;

            return this.#mapModelsToArrayFromModelOptions(modelsResponse);
        } catch (error) {
            this.#logger(LogLevel.Error, `Loading EasyDiffusion options failed: ${error}`);
            throw error;
        }
    }

    #mapModelsToArrayFromModelOptions(modelsResponse: IModelsResponse) {
        return this.#flattenModelArray(modelsResponse.options['stable-diffusion'], '', []);
    }

    #flattenModelArray(stableDiffusionOptions: JaggedRecursiveStringArray, parentName: string, models: Array<string>): Array<string> {
        if(!Array.isArray(stableDiffusionOptions)) {
            return models;
        }

        models = models || [];
        parentName = parentName || '';

        stableDiffusionOptions.forEach(item => {
            if(typeof item === JavaScriptType.String) {
                models.push(path.join(parentName, item as string));
            } else if (this.#isDirectoryModelArrayPair(item)) {
                models.concat(this.#flattenModelArray(item[1], path.join(parentName, item[0] as string), models));
            } else if (Array.isArray(item)) {
                models.concat(models.map(item => path.join(parentName, item)));
            } else {
                this.#logger(LogLevel.Warning, `Model option ${item} did not fit any expected model option type.`);
            }
        });

        // path.join on Windows returns '\' instead of '/'.
        models = models.map(x => x.replace('\\', '/'));

        return models;
    }

    #isDirectoryModelArrayPair(modelOptions: JaggedRecursiveStringArray): boolean {
        const isDirectoryModelArrayPair =
            modelOptions.length === 2
            && typeof modelOptions[0] === JavaScriptType.String
            && Array.isArray(modelOptions[1]);

        return isDirectoryModelArrayPair;
    }

    async #sleep(milliseconds: number): Promise<void> {
        return await new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    }
}
