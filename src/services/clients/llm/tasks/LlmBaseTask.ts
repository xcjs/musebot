import { Attachment, Message as DiscordMessage, MessageReaction } from 'discord.js';

import { TaskQueueStrategy } from '../../../../enums/TaskQueueStrategy.js';
import { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../features/IFeatureService.js';
import { IBotServiceContainer } from "../../../IBotServiceContainer.js"
import { ResourceType } from '../../../parallelization/ResourceType.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { LlmReplyService } from '../../chat/discord/llm/LlmReplyService.js';
import { LlmStreamingReplyService } from '../../chat/discord/llm/LlmStreamingReplyService.js';
import { IReplyService } from '../../chat/IReplyService.js';
import { ComfyUiClient } from '../../media/comfy-ui/ComfyUiClient.js';
import { ILlmClient } from '../ILlmClient.js';
import { LlmMessage } from '../models/LlmMessage.js';
import { IContextMessageFactory } from '../services/IContextMessageFactory.js';
import { IContextService } from '../services/IContextService.js';

export abstract class LlmBaseTask<T> extends BaseTask<T> {
  override get taskChannel(): string {
    return this.parallelizationStrategy.getTaskChannel(this.resourceType, this.isChild, this.llmClient.host);
  }

  override get resourceType(): ResourceType {
    return ResourceType.LargeLanguageModel;
  }

  readonly configurationService: IConfigurationService;
  readonly llmClient: ILlmClient;
  readonly contextMessageFactory: IContextMessageFactory<DiscordMessage, LlmMessage>;
  readonly contextService: IContextService<DiscordMessage, LlmMessage>;
  readonly llmReplyService: LlmReplyService;
  readonly llmStreamingReplyService: LlmStreamingReplyService;
  readonly replyService: IReplyService<DiscordMessage, MessageReaction, Attachment, DiscordMessage>;
  readonly #featureService: IFeatureService;
  readonly #comfyUiClient: ComfyUiClient;

  constructor(services: IBotServiceContainer) {
    super(services);

    this.configurationService = services.configurationService;
    this.llmClient = services.llmClient;
    this.contextMessageFactory = services.getContextMessageFactory<DiscordMessage, LlmMessage>();
    this.contextService = services.getContextService<DiscordMessage, LlmMessage>();
    this.llmReplyService = services.llmReplyService;
    this.llmStreamingReplyService = services.llmStreamingReplyService;
    this.replyService = services.getReplyService();
    this.#featureService = services.featureService;
    this.#comfyUiClient = services.comfyUiClient;
  }

  override async preProcess(): Promise<void> {
    await super.preProcess();

    if (this.configurationService.taskQueueStrategy === TaskQueueStrategy.Serial
      && (this.#featureService.hasFeature(SupportedFeature.ContextualImg2Img)
        || this.#featureService.hasFeature(SupportedFeature.Img2Img)
        || this.#featureService.hasFeature(SupportedFeature.Img2Vid)
        || this.#featureService.hasFeature(SupportedFeature.Txt2Audio)
        || this.#featureService.hasFeature(SupportedFeature.Txt2Img)
        || this.#featureService.hasFeature(SupportedFeature.Txt2Music)
        || this.#featureService.hasFeature(SupportedFeature.Txt2Vid))
    ) {
      const freed = await this.#comfyUiClient.free();
      if (!freed) {
        throw new Error('ComfyUI VRAM could not be freed; aborting to prevent LLM VRAM contention.');
      }
    }
  }

  override async process(): Promise<void> {
    await super.process();
  }

  override async postProcess(): Promise<void> {
    await super.postProcess();
  }
}