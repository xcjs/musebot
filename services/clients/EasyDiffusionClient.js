import {Logger, LogLevel } from 'meklog'
import fetch from 'node-fetch';

import { httpMethods } from '../../enums/httpMethods';
import { RenderRequest } from '../../models/RenderRequest';

export class EasyDiffusionClient {
    #environmentSettings = null;
    #logger = null;

    constructor(environmentSettings) {
        this.#environmentSettings = environmentSettings;
        this.#logger = new Logger(this.isProduction, 'EasyDiffusionClient');
    }

    async render(prompt) {
        const host = this.#environmentSettings.easyDiffusionHost;
        const model = this.#environmentSettings.easyDiffusionModel;

        const request = new RenderRequest(model, prompt);

        try {
            const response = await fetch(`${host}render`, {
                method: httpMethods.post,
                body: JSON.stringify(request)
            });

            return response.json();
        } catch(error) {
            this.#logger(LogLevel.Info, error);
            return null;
        }
    }

    async stream(renderResponse) {
        try {
            do {
                const response = await fetch(renderResponse.stream, httpMethods.get);
                await this.#sleep(1000);

                // Keep trying as long as the response type is 425 - Too Early.
            } while (response.status !== 425);
        } catch (error) {
            this.#logger(LogLevel.Error, error);
            return null;
        }
    }

    async #sleep(milliseconds) {
        return new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    }
}
