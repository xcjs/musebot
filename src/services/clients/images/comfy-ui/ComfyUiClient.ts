import { ComfyUIClient, ImagesResponse, Prompt } from 'comfy-ui-client';
import { Logger, LogLevel } from 'meklog';

import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';

export class ComfyUiClient {
    get host(): URL {
        return this.#host;
    }

    #environmentSettings: IEnvironmentSettings;

    #logger;

    #host: URL;
    #client: ComfyUIClient;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;

        this.#logger = Logger(this.#environmentSettings.isProduction, 'ComfyUiClient');

        this.#host = getRandomArrayEntry(this.#environmentSettings.stableDiffusionHosts);

        let comfyHost = `${this.#host.host}${this.#host.pathname}`;

        if(comfyHost.endsWith('/')) {
            comfyHost = comfyHost.substring(0, comfyHost.length - 1);
        }

        this.#client = new ComfyUIClient(comfyHost, 'Musebot');

        this.#logger(LogLevel.Info, `Selected host: ${this.#host}`);
    }

    async render(prompt: Prompt): Promise<ImagesResponse> {
        this.#logger(LogLevel.Info, 'Sending workflow to ComfyUI:', JSON.stringify(prompt));

        await this.#client.connect();

        delete prompt.$musebotDefaults;
        const images = await this.#client.getImages(prompt);

        await this.#client.disconnect();

        if(Object.keys(images).length === 0) {
            return Promise.reject('The render failed but was not reported as a failure by the Comfy UI client.');
        }

        return images;
    }

    async disconnect(): Promise<void> {
        try {
            await this.#client.interrupt();
        } catch {

        } finally {
            await this.#client.disconnect();
        }
    }
}
