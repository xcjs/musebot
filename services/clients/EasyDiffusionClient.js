import path from 'node:path';

import {Logger, LogLevel } from 'meklog'
import fetch from 'node-fetch';

import { contentTypes } from '../../enums/contentTypes.js';
import { httpHeaders } from '../../enums/httpHeaders.js';
import { httpMethods } from '../../enums/httpMethods.js';
import { httpStatusCodes } from '../../enums/httpStatusCodes.js';
import { javaScriptTypes } from '../../enums/javaScriptTypes.js';
import { EasyDiffusionRenderRequest } from '../../models/EasyDiffusionRenderRequest.js';
import { getRandomInt } from '../../utilities/random-utilities.js';

export class EasyDiffusionClient {
    #environmentSettings = null;
    #logger = null;

    #host = null;
    #model = null;

    #retryDelayInMilliseconds = 1000;

    #isBusy = false;

    get isBusy() {
        return this.#isBusy;
    }

    constructor(environmentSettings) {
        this.#environmentSettings = environmentSettings;
        this.#logger = new Logger(this.#environmentSettings.isProduction, 'EasyDiffusionClient');

        this.#host = this.#selectHost(this.#environmentSettings.easyDiffusionHosts);
        this.#model = this.#selectModel(this.#environmentSettings.easyDiffusionModels);
    }

    async render(prompt) {
        this.#logger(LogLevel.Info, 'Sending render request to EasyDiffusion...');

        // If no specific model was selected, we have to load available models
        // and choose one at random.
        if(this.#model === null) {
            const models = await this.#mapModelsToArrayFromModelOptions(await this.getModels());
            this.#model = this.#selectModel(models);
        }

        const request = new EasyDiffusionRenderRequest(this.#model, prompt);

        try {
            const response = await fetch(new URL('render', this.#host), {
                method: httpMethods.post,
                headers: {
                    [httpHeaders.contentType]: contentTypes.json
                },
                body: JSON.stringify(request)
            });

            return {
                request,
                response: await response.json()
            };
        } catch(error) {
            this.#logger(LogLevel.Info, error);
            return null;
        }
    }

    async stream(renderExchange) {
        this.#isBusy = true;

        const renderResponse = renderExchange?.response;

        if(renderResponse === null) {
            return null;
        }

        const streamUrl = new URL(renderResponse.stream, this.#host);

        let response = null;

        try {
            do {
                this.#logger(LogLevel.Info, `Checking response stream at ${renderResponse.stream}`);
                response = await fetch(streamUrl);

                if(response.status === httpStatusCodes.tooEarly) {
                    await this.#sleep(this.#retryDelayInMilliseconds);
                } else if(response.ok) {
                    let responseBody = null;

                    try {
                        responseBody = await response.json();

                        if(responseBody.status === 'failed') {
                            this.#isBusy = false;
                            return null;
                        } else if(responseBody.status === 'succeeded') {
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
            } while (response.ok || response.status === httpStatusCodes.tooEarly);

            this.#isBusy = false;
            return null;
        } catch (error) {
            this.#logger(LogLevel.Error, `Checking the EasyDiffusion render stream failed: ${error}`);

            this.#isBusy = false;
            return null;
        }
    }

    async getModels() {
        try {
            this.#logger(LogLevel.Info, `Loading Easy Diffusion options...`);
            const response = await fetch(new URL('/get/models?scan_for_malicious=true', this.#host), {
                headers: {
                    [httpHeaders.contentType]: contentTypes.json
                }
            });

            return await response.json();
        } catch (error) {
            this.#logger(LogLevel.Error, `Loading EasyDiffusion options failed: ${error}`);
            return null;
        }
    }

    #selectHost(hosts) {
        const host = hosts[getRandomInt(0, hosts.length - 1)];

        this.#logger(LogLevel.Info, `Selected host: ${host}`);

        return host;
    }

    #selectModel(models) {
        if(models.length === 0) {
            return null;
        }

        let model = models[getRandomInt(0, models.length - 1)];

        this.#logger(LogLevel.Info, `Selected model: ${model}`);

        return model;
    }

    #mapModelsToArrayFromModelOptions(modelOptions) {
        return this.#flattenModelArray(modelOptions.options['stable-diffusion'], '', []);
    }

    #flattenModelArray(stableDiffusionOptions, parentName, models) {
        models = models || [];
        parentName = parentName || '';

        stableDiffusionOptions.forEach(item => {
            if(typeof item === javaScriptTypes.string) {
                models.push(path.join(parentName, item));
            } else if (this.#isDirectoryModelArrayPair(item)) {
                models.concat(this.#flattenModelArray(item[1], path.join(parentName, item[0]), models));
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

    #isDirectoryModelArrayPair(modelOptions) {
        const isDirectoryModelArrayPair =
            modelOptions.length === 2
            && typeof modelOptions[0] === javaScriptTypes.string
            && Array.isArray(modelOptions[1]);

        return isDirectoryModelArrayPair;
    }

    async #sleep(milliseconds) {
        return await new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    }
}
