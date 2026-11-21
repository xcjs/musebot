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

  readonly #channelHostname: string | null;

  readonly #logger: ILogger;

  constructor(services: IBotServiceContainer, channelHostname: string | null = null) {
  this.#featureService = services.featureService;
  this.#llmClient = services.llmClient;
  this.#comfyUiClient = services.comfyUiClient;

  this.#channelHostname = channelHostname;

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
      if(this.#matchesChannelHostname(this.#comfyUiClient.host.hostname)) {
        await this.#comfyUiClient.free();
      } else {
        this.#logger.info(`Skipping ComfyUI free(): this channel is scoped to '${this.#channelHostname}' but the ComfyUI host is ${this.#comfyUiClient.host.hostname}.`);
      }
  }

  if(this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
      if(this.#matchesChannelHostname(this.#llmClient.host.hostname)) {
        await this.#llmClient.free();
      } else {
        this.#logger.info(`Skipping LLM free(): this channel is scoped to '${this.#channelHostname}' but the LLM host is ${this.#llmClient.host.hostname}.`);
      }
  }
  }

  #matchesChannelHostname(hostname: string): boolean {
  return this.#channelHostname === null || this.#channelHostname === hostname;
  }
}