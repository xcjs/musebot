import { OllamaClient } from '../clients/llm/ollama/OllamaClient.js';
import { ComfyUiClient } from '../clients/media/comfy-ui/ComfyUiClient.js';
import { SupportedFeature } from '../features/enum/SupportedFeature.js';
import { IFeatureService } from '../features/IFeatureService.js';
import { IBotServiceContainer } from '../IBotServiceContainer.js';
import { ILogger } from '../ILogger.js';
import { ITaskChannelPostProcessor } from './ITaskChannelPostProcessor.js';

export class GenerativeAiChannelPostProcessor implements ITaskChannelPostProcessor {
  readonly #featureService: IFeatureService;
  readonly #ollamaClient: OllamaClient;
  readonly #comfyUiClient: ComfyUiClient;

  readonly #logger: ILogger;

  constructor(services: IBotServiceContainer) {
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
      const freed = await this.#comfyUiClient.free();
      if (!freed) {
        this.#logger.warn('ComfyUI VRAM could not be freed during post-process.');
      }
    }

    if(this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
      const freed = await this.#ollamaClient.free();
      if (!freed) {
        this.#logger.warn('Ollama model could not be unloaded during post-process.');
      }
    }
  }
}
