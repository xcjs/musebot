import { IWorkflowService } from '../clients/media/comfy-ui/services/IWorkflowService.js';
import { IEnvironmentSettings } from '../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../ILogger.js';
import { IServiceContainer } from '../IServiceContainer.js';
import { SupportedFeature } from './enum/SupportedFeature.js';
import { IFeatureService } from './IFeatureService.js';

export class FeatureService implements IFeatureService {
    readonly #environmentSettings: IEnvironmentSettings;
    readonly #workflowService: IWorkflowService;

    readonly #logger: ILogger;

    readonly #supportedFeatures: SupportedFeature[] = [];

    get supportedFeatures(): SupportedFeature[] {
        return this.#supportedFeatures;
    }

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;

        this.#logger = services.getLogger('FeatureService');
    }

    hasFeature(feature: SupportedFeature): boolean {
        return this.#supportedFeatures.includes(feature);
    }

    async loadFeatures(): Promise<void> {
        await this.#workflowService.loadWorkflows();

        if (this.#environmentSettings.ollamaHosts.length > 0
            && this.#environmentSettings.ollamaModels.length > 0) {
                this.#logger.info(`${SupportedFeature.Txt2Txt} supported.`);
                this.#supportedFeatures.push(SupportedFeature.Txt2Txt);
        }

        if (!this.#workflowService.hasWorkflows) {
            return;
        }

        if (this.#environmentSettings.stableDiffusionHosts.length > 0) {
            for(const feature of Object.values(SupportedFeature)) {
                if(this.#workflowService.hasWorkflowType(feature)) {
                    this.#logger.info(`${feature} supported.`);
                    this.#supportedFeatures.push(feature);
                }
            }
        }
    }
}
