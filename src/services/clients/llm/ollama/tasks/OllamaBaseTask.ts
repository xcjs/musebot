import { Attachment, Message as DiscordMessage, MessageReaction } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { TaskQueueStrategy } from '../../../../../enums/TaskQueueStrategy.js';
import { IConfigurationService } from '../../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { ResourceType } from '../../../../parallelization/ResourceType.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { OllamaReplyService } from '../../../chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from '../../../chat/discord/ollama/OllamaStreamingReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { ComfyUiClient } from '../../../media/comfy-ui/ComfyUiClient.js';
import { IContextMessageFactory } from '../../services/IContextMessageFactory.js';
import { IContextService } from '../../services/IContextService.js';
import { OllamaClient } from '../OllamaClient.js';

export abstract class OllamaBaseTask<T> extends BaseTask<T> {
    override get taskChannel(): string {
        return this.parallelizationStrategy.getTaskChannel(this.resourceType, this.isChild, this.ollamaClient.host);
    }

    override get resourceType(): ResourceType {
        return ResourceType.LargeLanguageModel;
    }

    readonly configurationService: IConfigurationService;
    readonly ollamaClient: OllamaClient;
    readonly contextMessageFactory: IContextMessageFactory<DiscordMessage, OllamaMessage>;
    readonly contextService: IContextService<DiscordMessage, OllamaMessage>;
    readonly ollamaReplyService: OllamaReplyService;
    readonly ollamaStreamingReplyService: OllamaStreamingReplyService;
    readonly replyService: IReplyService<DiscordMessage, MessageReaction, Attachment, DiscordMessage>;
    readonly #featureService: IFeatureService;
    readonly #comfyUiClient: ComfyUiClient;

    constructor(services: IBotServiceContainer) {
        super(services);

        this.configurationService = services.configurationService;
        this.ollamaClient = services.ollamaClient;
        this.contextMessageFactory = services.getContextMessageFactory<DiscordMessage, OllamaMessage>();
        this.contextService = services.getContextService<DiscordMessage, OllamaMessage>();
        this.ollamaReplyService = services.ollamaReplyService;
        this.ollamaStreamingReplyService = services.ollamaStreamingReplyService;
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
            await this.#comfyUiClient.free();
        }
    }

    override async process(): Promise<void> {
        await super.process();
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();
    }
}
