import { Logger, LogLevel } from 'meklog';

import { IHttpExchange } from '../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { IPromptRequest } from './models/api/requests/IPromptRequest.js';
import { IPromptResponse } from './models/api/responses/IPromptResponse.js';

export class ComfyUiClient {
    #environmentSettings: IEnvironmentSettings;

    #logger;

    #host: URL;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;

        this.#logger = Logger(this.#environmentSettings.isProduction, 'ComfyUiClient');

        this.#host = getRandomArrayEntry(this.#environmentSettings.stableDiffusionHosts);
        this.#logger(LogLevel.Info, `Selected host: ${this.#host}`);
    }

    async render(workflow: IPromptRequest): Promise<IHttpExchange<IPromptRequest, IPromptResponse>> {

    }

    async getHistory(): Promise<IHistoryResponse> {

    }

    async getPromptHistory(promptResponse: IPromptResponse): Promise<IPromptHistoryResponse> {

    }

    async #poll(promptResponse: IPromptResponse): Promise<IHistoryResponse> {

    }
}
