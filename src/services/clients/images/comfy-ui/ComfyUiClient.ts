import { ComfyUIClient, ImagesResponse } from 'comfy-ui-client';
import { Logger, LogLevel } from 'meklog';

import workflow from '../../../../../workflows/txt2img-dreamshaper.json' with { type: 'json'};
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
        this.#client = new ComfyUIClient(this.#host.toString(), 'Musebot Development');

        this.#logger(LogLevel.Info, `Selected host: ${this.#host}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async render(): Promise<ImagesResponse> {
        await this.#client.connect();

        const images = await this.#client.getImages(workflow);

        await this.#client.disconnect();

        return images;
    }
}
