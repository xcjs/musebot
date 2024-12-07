import { CallWrapper, ComfyApi, PromptBuilder } from "@saintno/comfyui-sdk";
import { Logger, LogLevel } from 'meklog';

import workflow from '../../../../../workflows/txt2img-flux.json' with { type: 'json'};
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
    #client: ComfyApi;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;

        this.#logger = Logger(this.#environmentSettings.isProduction, 'ComfyUiClient');

        this.#host = getRandomArrayEntry(this.#environmentSettings.stableDiffusionHosts);
        this.#client = new ComfyApi(this.#host.toString());

        this.#logger(LogLevel.Info, `Selected host: ${this.#host}`);

        this.#client.on('log', (ev) => this.#logger(LogLevel.Info, ev.detail));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async render(): Promise<Record<'images', any>> {
        await this.#client.init().waitForReady();

        const promptBuilder = new PromptBuilder(workflow, [], ['images'])
            .setOutputNode('images', '110');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const promise = new Promise<Record<'images', any>>((resolve, reject) => {
            new CallWrapper(this.#client, promptBuilder)
                .onFinished((response) => {
                    resolve(response)
                })
                .onFailed((error) => {
                    reject(error);
                })
                .run();
        });

        return promise;
    }
}
