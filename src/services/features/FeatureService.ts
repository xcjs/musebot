import { IWorkflowService } from '../clients/media/comfy-ui/services/IWorkflowService.js';
import { IConfigurationService } from '../environment-settings/IConfigurationService.js';
import { IBotServiceContainer } from '../IBotServiceContainer.js';
import { ILogger } from '../ILogger.js';
import { SupportedFeature } from './enum/SupportedFeature.js';
import { IFeatureService } from './IFeatureService.js';

export class FeatureService implements IFeatureService {
    readonly #configurationService: IConfigurationService;
    readonly #workflowService: IWorkflowService;
    readonly #services: IBotServiceContainer;

    readonly #logger: ILogger;

    readonly #supportedFeatures: SupportedFeature[] = [];

    get supportedFeatures(): SupportedFeature[] {
        return this.#supportedFeatures;
    }

    constructor(services: IBotServiceContainer) {
        this.#configurationService = services.configurationService;
        this.#workflowService = services.workflowService;
        this.#services = services;

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

                await this.#probeVisionCapability();
        }

        if (this.#configurationService.ollamaHosts.length > 0
            && this.#configurationService.ollamaEmbeddingModel !== null) {
                this.#logger.info(`${SupportedFeature.LongTermMemory} supported.`);
                this.#supportedFeatures.push(SupportedFeature.LongTermMemory);
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

    async #probeVisionCapability(): Promise<void> {
        const models = this.#configurationService.ollamaModels;

        for (const model of models) {
            try {
                const client = this.#services.ollamaClient;
                const hasVision = await client.hasVisionCapability(model);

                if (hasVision) {
                    this.#logger.info(`${SupportedFeature.Vision} supported (model '${model}' on host '${client.host}').`);
                    this.#supportedFeatures.push(SupportedFeature.Vision);
                    return;
                }
            } catch (error) {
                this.#logger.warn(`Failed to probe vision capability for model '${model}':`, error);
            }
        }

        this.#logger.info(`${SupportedFeature.Vision} not supported by any configured model.`);
    }
}
