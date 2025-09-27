import { Message } from 'ollama';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ContextMessage } from '../models/ContextMessage.js';

export class ContextService<T> {
    #environmentSettings: IEnvironmentSettings;
    #logger: ILogger;

    #contextGroups: Record<string, ContextMessage<T>[]> = {};

    constructor(services: IServiceContainer) {
        this.#environmentSettings = this.#environmentSettings;
        this.#logger = services.getLogger('ContextService');
    }

    getContextByChannelId(channelId: string): ContextMessage<T>[] {
        this.#logger.info('Getting context from channel:', channelId);

        return this.#contextGroups[channelId] || [];
    }

    getContextByUserId(userId: string): ContextMessage<T>[] {
        this.#logger.info('Getting context by user:', userId);

        // TODO: Enumerate over object.values and then messages for messages
        // from a matching userId.
        return [];
    }

    getBaseOllamaContext<T>(context: ContextMessage<T>[]): Message[] {
        this.#logger.info('Getting base Ollama context...');

        const contextCopy = JSON.parse(JSON.stringify(context)) as ContextMessage<T>[];

        return contextCopy.map(message => {
            delete message.channelId;
            delete message.userId;
            delete message.timestamp;
            delete message.data;
            return message;
        });
    }

    addContext(context: ContextMessage<T>[]): void {
        context.forEach((newMessage) => {
            this.#logger.info('Adding new context to the channel:', newMessage.channelId);

            if(this.#contextGroups[newMessage.channelId] === undefined) {
                this.#contextGroups[newMessage.channelId] = [];
            }

            if (!this.#contextGroups[newMessage.channelId].find(x =>
                x.content === newMessage.content
                && x.role === newMessage.role)) {
                this.#contextGroups[newMessage.channelId].push(newMessage);
            }
        });
    }

    clearContext(channelId: string) {
        this.#contextGroups[channelId] = [];
    }
}
