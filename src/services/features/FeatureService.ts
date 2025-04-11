import { StableDiffusionApiType } from '../clients/images/stable-diffusion/enums/StableDiffusionApiType.js';
import { IEnvironmentSettings } from '../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../IServiceContainer.js';
import { SupportedFeature } from './enum/SupportedFeature.js';
import { IFeatureService } from './IFeatureService.js';

export class FeatureService implements IFeatureService {
    #environmentSettings: IEnvironmentSettings;

    #supportedFeatures: Array<SupportedFeature> = [];

    get supportedFeatures(): Array<SupportedFeature> {
        return this.#supportedFeatures;
    }

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;

        this.#determineSupportedFeatures();
    }

    hasFeature(feature: SupportedFeature): boolean {
        return this.#supportedFeatures.includes(feature);
    }

    #determineSupportedFeatures() {
        if (this.#environmentSettings.stableDiffusionApiType !== StableDiffusionApiType.None
            && this.#environmentSettings.stableDiffusionHosts.length > 0) {
            this.#supportedFeatures.push(SupportedFeature.ImageGeneration);
        }

        if(this.#environmentSettings.ollamaHosts.length > 0
            && this.#environmentSettings.ollamaModels.length > 0) {
            this.#supportedFeatures.push(SupportedFeature.TextGeneration);
        }
    }
}
