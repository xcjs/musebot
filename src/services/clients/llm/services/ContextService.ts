import { ILogger } from '../../../ILogger.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ContextMessage } from '../ollama/models/ContextMessage.js';
import { IContextService } from './IContextService.js';

export class ContextService<ChatMessageType, LlmMessageType> implements IContextService<ChatMessageType, LlmMessageType> {
    readonly #logger: ILogger;

    #context: ContextMessage<ChatMessageType, LlmMessageType>[] = [];

    constructor(services: IServiceContainer) {
        this.#logger = services.getLogger('ContextService');
    }

    addContext(context: ContextMessage<ChatMessageType, LlmMessageType>[]): void {
        context.forEach((newMessage) => {
            this.#logger.info('Adding new context to the channel:', newMessage.channelId);
                this.#context.push(newMessage);
        });
    }

    getContextByServerId(serverId: string): LlmMessageType[] {
        this.#logger.info('Getting context by server:', serverId);
        return this.#context.filter(x =>
            !x.isPrivate
            && (x.serverId === null // Include system or global messages.
                || x.serverId === serverId))
            .map(x => x.llmMessage);
    }

    getContextByChannelId(channelId: string): LlmMessageType[] {
        this.#logger.info('Getting context by channel:', channelId);
        return this.#context.filter(x =>
            !x.isPrivate
            && (x.channelId === null // Include system or global messages.
                || x.channelId === channelId))
            .map(x => x.llmMessage);
    }

    getContextByUserId(userId: string): LlmMessageType[] {
        this.#logger.info('Getting context by user:', userId);
        return this.#context.filter(x =>
            x.userId === null // Include system or global messages.
            || x.userId === userId)
            .map(x => x.llmMessage);
    }

    clearContext(channelId: string): void {
        this.#context = this.#context.filter(
            x => x.isReadOnly
            || x.channelId !== channelId);
    }
}
