import { Prompt } from 'comfy-ui-client';

import { PromisedSettledResultStatus } from '../../../../enums/PromisedSettledResultStatus.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../ILogger.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { IGenerativeChatClient } from '../../chat/IGenerativeChatClient.js';
import { ExtendedComfyUIClient } from './extensions/ExtendedComfyUIClient.js';
import { MediaCollectionResponse } from './extensions/MediaResponse.js';

export class ComfyUiClient {
    get host(): URL {
        return this.#host;
    }

    readonly #environmentSettings: IEnvironmentSettings;
    readonly #chatClient: IGenerativeChatClient;

    readonly #logger: ILogger;

    readonly #host: URL;
    readonly #client: ExtendedComfyUIClient;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;
        this.#chatClient = services.generativeChatClient;

        this.#logger = services.getLogger('ComfyUiClient');

        const host = getRandomArrayEntry(this.#environmentSettings.stableDiffusionHosts);

        if (!host) {
            throw new Error('No ComfyUI hosts configured in environment settings.');
        }

        this.#host = host;

        let comfyHost = `${this.#host.host}${this.#host.pathname}`;

        if(comfyHost.endsWith('/')) {
            comfyHost = comfyHost.substring(0, comfyHost.length - 1);
        }

        this.#client = new ExtendedComfyUIClient(comfyHost,
            `${this.#environmentSettings.applicationName}_${this.#chatClient.name}`);

        this.#logger.info(`Selected host: ${this.#host}`);
    }

    async render(prompts: Prompt[]): Promise<MediaCollectionResponse> {
        await this.#client.connect();

        const mediaCollectionResponsePromises: Promise<MediaCollectionResponse>[] = [];
        const mediaCollectionResponses: MediaCollectionResponse[] = [];

        prompts.forEach((prompt) => {
            this.#logger.info('Sending workflow to ComfyUI:', prompt);
            delete prompt.$musebotDefaults;
            mediaCollectionResponsePromises.push(this.#client.getMultiMedia(prompt));
        });

        await Promise.allSettled(mediaCollectionResponsePromises).then(async (results) => {
            await this.#client.disconnect();

            results.forEach(result => {
                if (result.status === PromisedSettledResultStatus.Fulfilled.toString()) {
                    mediaCollectionResponses.push((result as PromiseFulfilledResult<MediaCollectionResponse>).value);
                } else {
                    this.#logger.error('Error rendering prompt:', prompt, result);
                }
            });
        });

        const multiMediaResponse = this.#flattenMultipleMediaResponses(mediaCollectionResponses);

        if (Object.keys(multiMediaResponse).length === 0) {
            throw new Error('The render failed but was not reported as a failure by the Comfy UI client.');
        }

        return multiMediaResponse;
    }

    async free(): Promise<void> {
        try {
            await this.#client.free();
        } catch (error) {
            this.#logger.error('Failed to free ComfyUI resources:', error);
        }
    }

    async disconnect(): Promise<void> {
        try {
            await this.#client.interrupt();
        } catch {

        } finally {
            await this.#client.disconnect();
        }
    }

    #flattenMultipleMediaResponses(multiMediaResponses: MediaCollectionResponse[]): MediaCollectionResponse {
        const responseDictionary: MediaCollectionResponse = {};

        for (const multiMediaResponse of multiMediaResponses) {
            for (const [key, value] of Object.entries(multiMediaResponse)) {
                responseDictionary[key] ??= [];
                responseDictionary[key] = responseDictionary[key].concat(value);
            }
        }

        return responseDictionary;
    }

}
