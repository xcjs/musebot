import path from 'node:path';

import {Logger, LogLevel } from 'meklog'

import { ContentType } from '../../../enums/ContentType.js';
import { HttpHeader } from '../../../enums/HttpHeader.js';
import { HttpMethod } from '../../../enums/HttpMethod.js';
import { HttpStatusCode } from '../../../enums/HttpStatusCode.js';
import { JavaScriptType } from '../../../enums/JavaScriptType.js';
import { IHttpExchange } from '../../../models/IHttpExchange.js';
import { RenderRequest } from './models/requests/RenderRequest.js';
import { getRandomInt } from '../../../utilities/random-utilities.js';
import { EnvironmentSettings } from '../../EnvironmentSettings.js';
import { StreamStatus } from './enums/StreamStatus.js';
import { IRenderResponse } from './models/responses/IRenderResponse.js';
import { IStreamResponse } from './models/responses/IStreamResponse.js';
import { IModelsResponse } from './models/responses/IModelsResponse.js';
import { JaggedRecursiveStringArray } from './types/JaggedRecursiveStringArray.js';

export class EasyDiffusionClient {
    #environmentSettings: EnvironmentSettings;
    #logger;

    #host: URL;
    #model: string | null;

    #retryDelayInMilliseconds = 1000;

    #isBusy = true;

    get isBusy() {
        return this.#isBusy;
    }

    constructor(environmentSettings: EnvironmentSettings) {
        this.#environmentSettings = environmentSettings;

        this.#logger = Logger(this.#environmentSettings.isProduction, 'EasyDiffusionClient');

        const host = this.#selectHost(this.#environmentSettings.easyDiffusionHosts);

        if(host === null) {
            throw new Error('At least one EasyDiffusion host must be provided.');
        }

        this.#host = host;
        this.#model = this.#selectModel(this.#environmentSettings.easyDiffusionModels);
    }

    async render(prompt: string | RenderRequest): Promise<IHttpExchange<RenderRequest, IRenderResponse> | null> {
        this.#logger(LogLevel.Info, 'Sending render request to EasyDiffusion...');

        let request: RenderRequest;

        if(prompt instanceof RenderRequest) {
            this.#model = prompt.use_stable_diffusion_model;
            request = prompt;
        }

        if(this.#model === null) {
            this.#logger(LogLevel.Info, 'No model was provided - loading available models and selecting one at random.');

            const modelsResponse = await this.getModels();

            if(modelsResponse === null) {
                return null;
            }

            const models = await this.#mapModelsToArrayFromModelOptions(modelsResponse);
            this.#model = this.#selectModel(models);
        }

        request = prompt instanceof RenderRequest
            ? prompt
            : new RenderRequest(this.#model, prompt);

        try {
            const response = await fetch(new URL('render', this.#host), {
                method: HttpMethod.Post,
                headers: {
                    [HttpHeader.ContentType]: ContentType.Json
                },
                body: JSON.stringify(request)
            });

            return {
                request,
                response: await response.json() as IRenderResponse
            };
        } catch(error) {
            this.#logger(LogLevel.Info, error);
            return null;
        }
    }

    async stream(renderExchange: IHttpExchange<RenderRequest, IRenderResponse>) : Promise<IStreamResponse | null> {
        const renderResponse = renderExchange?.response;

        if(renderResponse === null) {
            this.#isBusy = false;
            return null;
        }

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
                            this.#isBusy = false;
                            return null;
                        } else if(responseBody.status === StreamStatus.Succeeded) {
                            this.#isBusy = false;
                            return responseBody;
                        }

                        await this.#sleep(this.#retryDelayInMilliseconds);
                    } catch {
                        // EasyDiffusion incorrectly uses the application/json response type for empty responses.
                        await this.#sleep(this.#retryDelayInMilliseconds);
                    }
                } else {
                    this.#isBusy = false;
                    return null;
                }

                // Keep trying as long as the response status is OK or 425 - Too Early.
            } while (response.ok || response.status === HttpStatusCode.TooEarly);

            this.#isBusy = false;
            return null;
        } catch (error) {
            this.#logger(LogLevel.Error, `Checking the EasyDiffusion render stream failed: ${error}`);

            this.#isBusy = false;
            return null;
        }
    }

    async getModels(): Promise<IModelsResponse | null> {
        try {
            this.#logger(LogLevel.Info, `Loading Easy Diffusion options...`);
            const response = await fetch(new URL('/get/models?scan_for_malicious=true', this.#host), {
                headers: {
                    [HttpHeader.ContentType]: ContentType.Json
                }
            });

            return await response.json() as IModelsResponse;
        } catch (error) {
            this.#logger(LogLevel.Error, `Loading EasyDiffusion options failed: ${error}`);
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

    async #sleep(milliseconds: number): Promise<null> {
        return await new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    }
}
