import {Logger, LogLevel } from 'meklog'
import fetch from 'node-fetch';

import { httpMethods } from '../../enums/httpMethods.js';
import { httpStatusCodes } from '../../enums/httpStatusCodes.js';
import { RenderRequest } from '../../models/RenderRequest.js';

export class EasyDiffusionClient {
    #environmentSettings = null;
    #logger = null;
    #retryDelayInMilliseconds = 1000;

    constructor(environmentSettings) {
        this.#environmentSettings = environmentSettings;
        this.#logger = new Logger(this.#environmentSettings.isProduction, 'EasyDiffusionClient');
    }

    async render(prompt) {
        this.#logger(LogLevel.Info, 'Sending render request to EasyDiffusion...');

        const host = this.#environmentSettings.easyDiffusionHosts[0];
        const model = this.#environmentSettings.easyDiffusionModel;

        const request = new RenderRequest(model, prompt);

        try {
            const response = await fetch(new URL('render', host), {
                method: httpMethods.post,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(request)
            });

            return await response.json();
        } catch(error) {
            this.#logger(LogLevel.Info, error);
            return null;
        }
    }

    async stream(renderResponse) {
        const streamUrl = new URL(renderResponse.stream, this.#environmentSettings.easyDiffusionHosts[0]);

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

                        if(responseBody.status === 'succeeded') {
                            return responseBody;
                        } else {
                            await this.#sleep(this.#retryDelayInMilliseconds);
                        }
                    } catch {
                        // EasyDiffusion incorrectly uses the application/json response type for empty responses.
                        await this.#sleep(this.#retryDelayInMilliseconds);
                    }
                } else {
                    return null;
                }

                // Keep trying as long as the response type is 425 - Too Early.
            } while (response.ok || response.status === httpStatusCodes.tooEarly);
        } catch (error) {
            this.#logger(LogLevel.Error, `Checking the EasyDiffusion render stream failed: ${error}`);
            return null;
        }
    }

    async #sleep(milliseconds) {
        return await new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    }
}
