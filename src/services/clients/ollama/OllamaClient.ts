import { EnvironmentSettings } from '../../../models/EnvironmentSettings';

export class OllamaClient {
    #environmentSettings: EnvironmentSettings;

    constructor(environmentSettings: EnvironmentSettings) {
        this.#environmentSettings = environmentSettings;
    }

    async sendMessage() {

    }
}
