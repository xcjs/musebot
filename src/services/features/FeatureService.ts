import { Logger, LogLevel } from 'meklog';

import { IWorkflowService } from '../clients/images/comfy-ui/services/IWorkflowService.js';
import { StableDiffusionApiType } from '../clients/images/stable-diffusion/enums/StableDiffusionApiType.js';
import { IEnvironmentSettings } from '../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../IServiceContainer.js';
import { SupportedFeature } from './enum/SupportedFeature.js';
import { IFeatureService } from './IFeatureService.js';

export class FeatureService implements IFeatureService {
    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;

    #logger;

    #supportedFeatures: Array<SupportedFeature> = [];

    get supportedFeatures(): Array<SupportedFeature> {
        return this.#supportedFeatures;
    }

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'FeatureService');
    }

    hasFeature(feature: SupportedFeature): boolean {
        return this.#supportedFeatures.includes(feature);
    }

    async loadFeatures(): Promise<void> {
        if (this.#environmentSettings.ollamaHosts.length > 0
            && this.#environmentSettings.ollamaModels.length > 0) {
                this.#logger(LogLevel.Info, `${SupportedFeature.Txt2Txt} supported.`);
                this.#supportedFeatures.push(SupportedFeature.Txt2Txt);
        }

        await this.#workflowService.loadWorkflows();

        if (!this.#workflowService.hasWorkflows) {
            return;
        }

        if (this.#environmentSettings.stableDiffusionApiType !== StableDiffusionApiType.None
            && this.#environmentSettings.stableDiffusionHosts.length > 0) {
            if (this.#workflowService.hasWorkflowType(SupportedFeature.Img2Img)) {
                this.#logger(LogLevel.Info, `${SupportedFeature.Img2Img} supported.`);
                this.#supportedFeatures.push(SupportedFeature.Img2Img);
            }

            if (this.#workflowService.hasWorkflowType(SupportedFeature.Img2ImgUpscaling)) {
                this.#logger(LogLevel.Info, `${SupportedFeature.Img2ImgUpscaling} supported.`);
                this.#supportedFeatures.push(SupportedFeature.Img2ImgUpscaling);
            }

            if (this.#workflowService.hasWorkflowType(SupportedFeature.Img2Vid)) {
                this.#logger(LogLevel.Info, `${SupportedFeature.Img2Vid} supported.`);
                this.#supportedFeatures.push(SupportedFeature.Img2Vid);
            }

            if (this.#workflowService.hasWorkflowType(SupportedFeature.Txt2Img)) {
                this.#logger(LogLevel.Info, `${SupportedFeature.Txt2Img} supported.`);
                this.#supportedFeatures.push(SupportedFeature.Txt2Img);
            }

            if (this.#workflowService.hasWorkflowType(SupportedFeature.Txt2Vid)) {
                this.#logger(LogLevel.Info, `${SupportedFeature.Txt2Vid} supported.`);
                this.#supportedFeatures.push(SupportedFeature.Txt2Vid);
            }
        }
    }
}
