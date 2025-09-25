import { Message } from 'ollama';

import { ContextMessage } from '../models/ContextMessage.js';

export class ContextService<T> {
    get context(): ContextMessage<T>[] {
        return this.#context;
    }

    #context: ContextMessage<T>[] = [];

    constructor() {

    }

    getBaseOllamaContext(): Message[] {
        const contextCopy = JSON.parse(JSON.stringify(this.#context)) as ContextMessage<T>[];

        return contextCopy.map(message => {
            delete message.timestamp;
            delete message.user;
            return message;
        });
    }

    addContext(context: ContextMessage<T>[]): void {
        context.forEach((newMessage) => {
            if (!this.#context.find(x =>
                x.content === newMessage.content
                && x.role === newMessage.role)) {
                this.#context.push(newMessage);
            }
        });
    }
}
