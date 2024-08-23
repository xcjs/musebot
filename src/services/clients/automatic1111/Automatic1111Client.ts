import StableDiffusionApi, { StableDiffusionModel, Txt2ImgOptions } from 'stable-diffusion-api';
import StableDiffusionResult from 'stable-diffusion-api/dist/lib/StableDiffusionResult.js';
import {Logger, LogLevel } from 'meklog'

import { getRandomArrayEntry } from '../../../utilities/random-utilities.js';
import { EnvironmentSettings } from '../../EnvironmentSettings.js';
import { IHttpExchangeWithAttachedData } from '../../../models/IHttpExchangeWithAttachedData.js';

export class Automatic1111Client {
    #environmentSettings: EnvironmentSettings;
    #logger;

    #host: URL;
    #client: StableDiffusionApi;

    get host(): URL {
        return this.#host;
    }

    constructor(environmentSettings: EnvironmentSettings) {
        this.#environmentSettings = environmentSettings;
        this.#logger = Logger(this.#environmentSettings.isProduction, 'Automatic1111Client');

        this.#host = getRandomArrayEntry(this.#environmentSettings.stableDiffusionHosts);
        this.#logger(LogLevel.Info, `Selected host: ${this.#host}`);

        this.#client = new StableDiffusionApi({
            baseUrl: this.#host.toString()
        });
    }

    async render(renderRequest: Txt2ImgOptions, model: string)
    : Promise<IHttpExchangeWithAttachedData<Txt2ImgOptions, StableDiffusionResult, string>> {
        this.#logger(LogLevel.Info, 'Sending txt2img request to Automatic1111...');

        try {
            await this.#client.setModel(model);

            return {
                exchange: {
                    request: renderRequest,
                    response: await this.#client.txt2img(renderRequest),
                },
                data: model
            };
        } catch(error) {
            this.#logger(LogLevel.Info, error);
            throw error;
        }
    }

    async getModels(): Promise<Array<StableDiffusionModel>> {
        try {
            this.#logger(LogLevel.Info, `Loading Automatic1111 models...`);

            return await this.#client.getSdModels();
        } catch (error) {
            this.#logger(LogLevel.Error, `Loading Automatic1111 models failed: ${error}`);
            throw error;
        }
    }
}
