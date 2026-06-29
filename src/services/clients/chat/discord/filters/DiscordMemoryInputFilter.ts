import { Message as DiscordMessage } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { LlmChatMessage } from '../../../llm/ollama/models/LlmChatMessage.js';
import { IMemoryService } from '../../../llm/services/IMemoryService.js';
import { IInputChatMessageFilter } from '../../IInputChatMessageFilter.js';

export class DiscordMemoryInputFilter implements IInputChatMessageFilter<DiscordMessage> {
    readonly #memoryService: IMemoryService;

    constructor(services: IBotServiceContainer) {
        this.#memoryService = services.getMemoryService();
    }

    async process(llmChatMessage: LlmChatMessage, chatMessage: DiscordMessage, context: OllamaMessage[]): Promise<OllamaMessage[]> {
        if (!this.#memoryService.isEnabled) {
            return context;
        }

        const memories = await this.#memoryService.retrieve(llmChatMessage);

        if (memories.length === 0) {
            return context;
        }

        return [...memories, ...context];
    }
}