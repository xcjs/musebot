import { Attachment, ButtonInteraction, Message, MessageReaction } from 'discord.js';
import { Message as DiscordMessage } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ResourceType } from '../../../../parallelization/ResourceType.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { OllamaReplyService } from '../../../chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from '../../../chat/discord/ollama/OllamaStreamingReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IContextMessageFactory } from '../../services/IContextMessageFactory.js';
import { IContextService } from '../../services/IContextService.js';
import { OllamaClient } from '../OllamaClient.js';

export abstract class OllamaBaseTask<T> extends BaseTask<T> {
    override get taskChannel(): string {
        return this.parallelizationStrategy.getTaskChannel(this.resourceType, this.ollamaClient.host);
    }

    override get resourceType(): ResourceType | null {
        return ResourceType.LargeLanguageModel;
    }

    environmentSettings: IEnvironmentSettings;
    ollamaClient: OllamaClient;
    contextMessageFactory: IContextMessageFactory<DiscordMessage, OllamaMessage>;
    contextService: IContextService<DiscordMessage, OllamaMessage>;
    ollamaReplyService: OllamaReplyService;
    ollamaStreamingReplyService: OllamaStreamingReplyService;
    replyService: IReplyService<DiscordMessage, MessageReaction, Attachment, Message | ButtonInteraction>;

    constructor(services: IServiceContainer) {
        super(services);

        this.environmentSettings = services.environmentSettings;
        this.ollamaClient = services.ollamaClient;
        this.contextMessageFactory = services.getContextMessageFactory<DiscordMessage, OllamaMessage>();
        this.contextService = services.getContextService<DiscordMessage, OllamaMessage>();
        this.ollamaReplyService = services.ollamaReplyService;
        this.ollamaStreamingReplyService = services.ollamaStreamingReplyService;
        this.replyService = services.getReplyService();
    }

    override async process(): Promise<void> {
        await super.process();
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();
    }
}
