import { EnvironmentSettings } from '../../../models/EnvironmentSettings.js';

export class OllamaClient {
    #environmentSettings: EnvironmentSettings;

    constructor(environmentSettings: EnvironmentSettings) {
        this.#environmentSettings = environmentSettings;
    }

    async sendMessage() {

    }
}
