import { ComfyUIClient, ImagesResponse, Prompt } from 'comfy-ui-client';

import { APPLICATION_NAME } from '../../../../constants/Globals.js';
import { PromisedSettledResultStatus } from '../../../../enums/PromisedSettledResultStatus.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../ILogger.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { IGenerativeChatClient } from '../../chat/IGenerativeChatClient.js';

export class ComfyUiClient {
    get host(): URL {
        return this.#host;
    }

    #environmentSettings: IEnvironmentSettings;
    #chatClient: IGenerativeChatClient;

    #logger: ILogger;

    #host: URL;
    #client: ComfyUIClient;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;
        this.#chatClient = services.generativeChatClient;

        this.#logger = services.getLogger('ComfyUiClient');

        this.#host = getRandomArrayEntry(this.#environmentSettings.stableDiffusionHosts);

        let comfyHost = `${this.#host.host}${this.#host.pathname}`;

        if(comfyHost.endsWith('/')) {
            comfyHost = comfyHost.substring(0, comfyHost.length - 1);
        }

        this.#client = new ComfyUIClient(comfyHost, `${APPLICATION_NAME}_${this.#chatClient.name}`);

        this.#logger.info(`Selected host: ${this.#host}`);
    }

    async render(prompts: Prompt[]): Promise<ImagesResponse> {
        await this.#client.connect();

        const imagesPromises: Promise<ImagesResponse>[] = [];
        const imagesResponses: ImagesResponse[] = [];

        prompts.forEach((prompt) => {
            this.#logger.info('Sending workflow to ComfyUI:', JSON.stringify(prompt));
            delete prompt.$musebotDefaults;
            imagesPromises.push(this.#client.getImages(prompt));
        });

        await Promise.allSettled(imagesPromises).then(async (results) => {
            await this.#client.disconnect();

            results.forEach(result => {
                if(result.status === PromisedSettledResultStatus.Fulfilled) {
                    imagesResponses.push(result.value);
                } else {
                    this.#logger.error(`Error rendering prompt ${prompt.name}:`, result.reason);
                }
            });
        });

        const imagesResponse = this.#flattenMultipleImagesResponses(imagesResponses);

        if(Object.keys(imagesResponse).length === 0) {
            return Promise.reject(new Error('The render failed but was not reported as a failure by the Comfy UI client.'));
        }

        return imagesResponse;
    }

    async disconnect(): Promise<void> {
        try {
            await this.#client.interrupt();
        } catch {

        } finally {
            await this.#client.disconnect();
        }
    }

    #flattenMultipleImagesResponses(imagesResponses: Array<ImagesResponse>): ImagesResponse {
        const imagesResponse: ImagesResponse = {};

        for (const imageResponse of imagesResponses) {
            for (const [key, value] of Object.entries(imageResponse)) {
                if (imagesResponse[key] === undefined) {
                    imagesResponse[key] = [];
                }

                imagesResponse[key] = imagesResponse[key].concat(value);
            }
        }

        return imagesResponse;
    }
}
