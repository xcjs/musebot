import { OllamaClient } from '../clients/llm/ollama/OllamaClient.js';
import { ComfyUiClient } from '../clients/media/comfy-ui/ComfyUiClient.js';
import { SupportedFeature } from '../features/enum/SupportedFeature.js';
import { IFeatureService } from '../features/IFeatureService.js';
import { ILogger } from '../ILogger.js';
import { IServiceContainer } from '../IServiceContainer.js';
import { ITaskChannelPostProcessor } from './ITaskChannelPostProcessor.js';

export class GenerativeAiChannelPostProcessor implements ITaskChannelPostProcessor {
  readonly #featureService: IFeatureService;
  readonly #ollamaClient: OllamaClient;
  readonly #comfyUiClient: ComfyUiClient;

  readonly #logger: ILogger;

  constructor(services: IServiceContainer) {
    this.#featureService = services.featureService;
    this.#ollamaClient = services.ollamaClient;
    this.#comfyUiClient = services.comfyUiClient;

    this.#logger = services.getLogger('GenerativeAiChannelPostProcessor');
  }

  async postProcess(): Promise<void> {
    this.#logger.info('Running Ollama and ComfyUI post-processors.');

    if(this.#featureService.hasFeature(SupportedFeature.Txt2Audio)
      || this.#featureService.hasFeature(SupportedFeature.Txt2Img)
      || this.#featureService.hasFeature(SupportedFeature.ContextualImg2Img)
      || this.#featureService.hasFeature(SupportedFeature.Img2Img)
      || this.#featureService.hasFeature(SupportedFeature.Img2Vid)
      || this.#featureService.hasFeature(SupportedFeature.Img2Vid)
      || this.#featureService.hasFeature(SupportedFeature.Txt2Music)
      || this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
      await this.#comfyUiClient.free();
    }

    if(this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
      await this.#ollamaClient.free();
    }
  }
}
