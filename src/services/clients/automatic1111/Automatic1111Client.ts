import { Logger, LogLevel } from 'meklog'

import { getRandomArrayEntry } from '../../../utilities/random-utilities.js';
import { EnvironmentSettings } from '../../EnvironmentSettings.js';
import { IHttpExchangeWithAttachedData } from '../../../models/IHttpExchangeWithAttachedData.js';
import { HttpMethod } from '../../../enums/HttpMethod.js';
import { HttpHeader } from '../../../enums/HttpHeader.js';
import { ContentType } from '../../../enums/ContentType.js';
import { Txt2ImgOptionsRequest } from './models/requests/Txt2ImgOptionsRequest.js';
import { StableDiffusionModel } from './models/requests/StableDiffusionModel.js';
import { StableDiffusionOptions } from './models/requests/models/StableDiffusionOptions.js';
import { Txt2ImgOptionsResponse } from './models/responses/Txt2ImgOptionsResponse.js';

export class Automatic1111Client {
    #environmentSettings: EnvironmentSettings;
    #logger;

    #host: URL;

    get host(): URL {
        return this.#host;
    }

    constructor(environmentSettings: EnvironmentSettings) {
        this.#environmentSettings = environmentSettings;
        this.#logger = Logger(this.#environmentSettings.isProduction, 'Automatic1111Client');

        this.#host = getRandomArrayEntry(this.#environmentSettings.stableDiffusionHosts);
        this.#logger(LogLevel.Info, `Selected host: ${this.#host}`);
    }

    async render(renderRequest: Txt2ImgOptionsRequest, model: string)
    : Promise<IHttpExchangeWithAttachedData<Txt2ImgOptionsRequest, Txt2ImgOptionsResponse, string>> {
        this.#logger(LogLevel.Info, 'Sending txt2img request to Automatic1111...');

        try {
            await this.#setModel(model);

            const response = await fetch(new URL('/sdapi/v1/txt2img', this.#host), {
                method: HttpMethod.Post,
                headers: {
                    [HttpHeader.ContentType]: ContentType.Json
                },
                body: JSON.stringify(renderRequest),
                signal: AbortSignal.timeout(1000 * 60 * 20)
            });

            return {
                exchange: {
                    request: renderRequest,
                    response: await response.json() as Txt2ImgOptionsResponse,
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

            const response = await fetch(new URL('/sdapi/v1/sd-models', this.#host), {
                headers: {
                    [HttpHeader.ContentType]: ContentType.Json
                }
            });

            return await response.json() as Array<StableDiffusionModel>;
        } catch (error) {
            this.#logger(LogLevel.Error, `Loading Automatic1111 models failed: ${error}`);
            throw error;
        }
    }

    async #setModel(model: string): Promise<void> {
        try {
            this.#logger(LogLevel.Info, `Setting the active image generation model...`);

            const options: StableDiffusionOptions = {
                sd_model_checkpoint: model
            };

            await fetch(new URL('/sdapi/v1/options', this.#host), {
                method: HttpMethod.Post,
                headers: {
                    [HttpHeader.ContentType]: ContentType.Json
                },
                body: JSON.stringify(options)
            });
        } catch(error) {
            this.#logger(LogLevel.Info, error);
            throw error;
        }
    }
}
