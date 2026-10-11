import { ILlmClient } from '../clients/llm/ILlmClient.js';
import { ComfyUiClient } from '../clients/media/comfy-ui/ComfyUiClient.js';
import { SupportedFeature } from '../features/enum/SupportedFeature.js';
import { IFeatureService } from '../features/IFeatureService.js';
import { IBotServiceContainer } from '../IBotServiceContainer.js';
import { ILogger } from '../ILogger.js';
import { ITaskChannelPostProcessor } from './ITaskChannelPostProcessor.js';

export class GenerativeAiChannelPostProcessor implements ITaskChannelPostProcessor {
  readonly #featureService: IFeatureService;
  readonly #llmClient: ILlmClient;
  readonly #comfyUiClient: ComfyUiClient;

  readonly #logger: ILogger;

  constructor(services: IBotServiceContainer) {
  this.#featureService = services.featureService;
  this.#llmClient = services.llmClient;
  this.#comfyUiClient = services.comfyUiClient;

  this.#logger = services.getLogger('GenerativeAiChannelPostProcessor');
  }

  async postProcess(): Promise<void> {
  this.#logger.info('Running LLM and ComfyUI post-processors.');

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
      await this.#llmClient.free();
  }
  }
}