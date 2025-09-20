import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ApiResourceType } from '../../../../parallelization/ApiResourceType.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { OllamaReplyService } from '../../../chat/discord/ollama/OllamaReplyService.js';
import { OllamaStreamingReplyService } from '../../../chat/discord/ollama/OllamaStreamingReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { OllamaClient } from '../OllamaClient.js';

export abstract class OllamaBaseTask<T> extends BaseTask<T> {
    override get taskChannel(): string {
        return this.parallelizationStrategy.getTaskChannel(ApiResourceType.Media, this.ollamaClient.host);
    }

    environmentSettings: IEnvironmentSettings;
    ollamaClient: OllamaClient;
    ollamaReplyService: OllamaReplyService;
    ollamaStreamingReplyService: OllamaStreamingReplyService;
    replyService: IReplyService;

    constructor(services: IServiceContainer) {
        super(services);

        this.environmentSettings = services.environmentSettings;
        this.ollamaClient = services.ollamaClient;
        this.ollamaReplyService = services.ollamaReplyService;
        this.ollamaStreamingReplyService = services.ollamaStreamingReplyService;
        this.replyService = services.replyService;
    }

    override async process(): Promise<void> {
        await super.process();
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();
    }
}
