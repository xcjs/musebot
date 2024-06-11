import {Logger, LogLevel } from 'meklog'
import fetch from 'node-fetch';

import { httpMethods } from '../../enums/httpMethods.js';
import { httpStatusCodes } from '../../enums/httpStatusCodes.js';
import { EasyDiffusionRenderRequest } from '../../models/EasyDiffusionRenderRequest.js';
import { getRandomInt } from '../../utilities/random-utilities.js';

export class EasyDiffusionClient {
    #environmentSettings = null;
    #logger = null;

    #host = null;
    #model = null;

    #retryDelayInMilliseconds = 1000;

    constructor(environmentSettings) {
        this.#environmentSettings = environmentSettings;
        this.#logger = new Logger(this.#environmentSettings.isProduction, 'EasyDiffusionClient');

        this.#host = this.#selectHost();
        this.#model = this.#selectModel();
    }

    async render(prompt) {
        this.#logger(LogLevel.Info, 'Sending render request to EasyDiffusion...');

        const request = new EasyDiffusionRenderRequest(this.#model, prompt);

        try {
            const response = await fetch(new URL('render', this.#host), {
                method: httpMethods.post,
                headers: {
                    'Content-Type': 'application/json'
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
        const renderResponse = renderExchange.response;
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
                            return null;
                        }

                        if(responseBody.status === 'succeeded') {
                            return responseBody;
                        }

                        await this.#sleep(this.#retryDelayInMilliseconds);

                    } catch {
                        // EasyDiffusion incorrectly uses the application/json response type for empty responses.
                        await this.#sleep(this.#retryDelayInMilliseconds);
                    }
                } else {
                    return null;
                }

                // Keep trying as long as the response status is OK or 425 - Too Early.
            } while (response.ok || response.status === httpStatusCodes.tooEarly);

            return null;
        } catch (error) {
            this.#logger(LogLevel.Error, `Checking the EasyDiffusion render stream failed: ${error}`);
            return null;
        }
    }

    #selectHost() {
        const host = this.#environmentSettings.easyDiffusionHosts[
            getRandomInt(0, this.#environmentSettings.easyDiffusionHosts.length - 1)];

        this.#logger(LogLevel.Info, `Selected host: ${host}`);

        return host;
    }

    #selectModel() {
        const model = this.#environmentSettings.easyDiffusionModels[
            getRandomInt(0, this.#environmentSettings.easyDiffusionModels.length - 1)];

        this.#logger(LogLevel.Info, `Selected model: ${model}`);

        return model;
    }

    async #sleep(milliseconds) {
        return await new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    }
}
