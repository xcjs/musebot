import { IWorkflowService } from '../clients/media/comfy-ui/services/IWorkflowService.js';
import { IConfigurationService } from '../environment-settings/IConfigurationService.js';
import { IBotServiceContainer } from '../IBotServiceContainer.js';
import { ILogger } from '../ILogger.js';
import { SupportedFeature } from './enum/SupportedFeature.js';
import { IFeatureService } from './IFeatureService.js';

export class FeatureService implements IFeatureService {
    readonly #configurationService: IConfigurationService;
    readonly #workflowService: IWorkflowService;

    readonly #logger: ILogger;

    readonly #supportedFeatures: SupportedFeature[] = [];

    get supportedFeatures(): SupportedFeature[] {
        return this.#supportedFeatures;
    }

    constructor(services: IBotServiceContainer) {
        this.#configurationService = services.configurationService;
        this.#workflowService = services.workflowService;

        this.#logger = services.getLogger('FeatureService');
    }

    hasFeature(feature: SupportedFeature): boolean {
        return this.#supportedFeatures.includes(feature);
    }

    async loadFeatures(): Promise<void> {
        await this.#workflowService.loadWorkflows();

        if (this.#configurationService.ollamaHosts.length > 0
            && this.#configurationService.ollamaModels.length > 0) {
                this.#logger.info(`${SupportedFeature.Txt2Txt} supported.`);
                this.#supportedFeatures.push(SupportedFeature.Txt2Txt);
        }

        if (!this.#workflowService.hasWorkflows) {
            return;
        }

        if (this.#configurationService.comfyUiHosts.length > 0) {
            for(const feature of Object.values(SupportedFeature)) {
                if(this.#workflowService.hasWorkflowType(feature)) {
                    this.#logger.info(`${feature} supported.`);
                    this.#supportedFeatures.push(feature);
                }
            }
        }
    }
}
