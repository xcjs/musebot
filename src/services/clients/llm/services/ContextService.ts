import { IEnvironmentSettings } from '../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../ILogger.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ContextMessage } from '../ollama/models/ContextMessage.js';
import { IContextService } from './IContextService.js';

export class ContextService<ChatMessageType, LlmMessageType> implements IContextService<ChatMessageType, LlmMessageType> {
    #environmentSettings: IEnvironmentSettings;
    #logger: ILogger;

    #context: ContextMessage<ChatMessageType, LlmMessageType>[] = [];

    constructor(services: IServiceContainer) {
        this.#environmentSettings = this.#environmentSettings;
        this.#logger = services.getLogger('ContextService');
    }

    addContext(context: ContextMessage<ChatMessageType, LlmMessageType>[]): void {
        context.forEach((newMessage) => {
            this.#logger.info('Adding new context to the channel:', newMessage.channelId);

            if (!this.#context.find(x =>
                x.messageId === newMessage.messageId)) {
                this.#context.push(newMessage);
            }
        });
    }

    getContextByServerId(serverId: string): ContextMessage<ChatMessageType, LlmMessageType>[] {
        this.#logger.info('Getting context by server:', serverId);
        return this.#context.filter(x => x.serverId === serverId);
    }

    getContextByChannelId(channelId: string): ContextMessage<ChatMessageType, LlmMessageType>[] {
        this.#logger.info('Getting context by channel:', channelId);
        return this.#context.filter(x => x.channelId === channelId);
    }

    getContextByUserId(userId: string): ContextMessage<ChatMessageType, LlmMessageType>[] {
        this.#logger.info('Getting context by user:', userId);
        return this.#context.filter(x => x.userId === userId);
    }

    getBaseLlmContext(): LlmMessageType[] {
        this.#logger.info('Getting base LLM context...');
        return this.#context.map(x => x.llmMessage);
    }

    clearContext() {
        this.#context = this.#context.filter(x => x.keepInContext);
    }
}

