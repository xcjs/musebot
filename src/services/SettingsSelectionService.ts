import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from './EnvironmentSettings.js';
import { EasyDiffusionClient } from './clients/easy-diffusion/EasyDiffusionClient';
import { getRandomInt } from '../utilities/random-utilities.js';


export class SettingsSelectionService {
    #environmentSettings: EnvironmentSettings;
    #easyDiffusionClient: EasyDiffusionClient;

    #logger;

    constructor(environmentSettings: EnvironmentSettings, easyDiffusionClient: EasyDiffusionClient) {
        this.#environmentSettings = environmentSettings;
        this.#easyDiffusionClient = easyDiffusionClient;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'SettingsSelectionService');
    }

    async getEasyDiffusionModel(): Promise<string | null> {
        let models = this.#environmentSettings.easyDiffusionModels;
        let model: string | null = null;

        if(models.length === 0) {
            models = await this.#easyDiffusionClient.getModels();
        }

        if(models.length === 1) {
            model = models[0];
        } else if(models.length > 1) {
            model = models[getRandomInt(0, models.length - 1)];
        }

        if(model !== null) {
            this.#logger(LogLevel.Info, `Selected model: ${model}`);
        }

        return Promise.resolve(model);
    }
}
