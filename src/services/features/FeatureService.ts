import { EnvironmentSettings } from '../EnvironmentSettings.js';
import { SupportedFeature } from './enum/SupportedFeature.js';

export class FeatureService {
    #environmentSettings: EnvironmentSettings;

    #supportedFeatures: Array<SupportedFeature> = [];

    get supportedFeatures(): Array<SupportedFeature> {
        return this.#supportedFeatures;
    }

    constructor(environmentSettings: EnvironmentSettings) {
        this.#environmentSettings = environmentSettings;

        this.#determineSupportedFeatures();
    }

    hasFeature(feature: SupportedFeature): boolean {
        return this.#supportedFeatures.includes(feature);
    }

    #determineSupportedFeatures() {
        if (this.#environmentSettings.stableDiffusionHosts.length) {
            this.#supportedFeatures.push(SupportedFeature.ImageGeneration);
        }

        if(this.#environmentSettings.ollamaHosts.length > 0
            && this.#environmentSettings.ollamaModels.length > 0) {
            this.#supportedFeatures.push(SupportedFeature.TextGeneration);
        }

        if(this.supportedFeatures.includes(SupportedFeature.ImageGeneration)
            && this.supportedFeatures.includes(SupportedFeature.TextGeneration)) {
            this.supportedFeatures.push(SupportedFeature.ImagesAndText);
        }
    }
}
