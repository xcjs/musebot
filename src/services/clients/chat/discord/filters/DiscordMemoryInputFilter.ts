import { Message as DiscordMessage } from 'discord.js';

import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { LlmChatMessage } from '../../../llm/models/LlmChatMessage.js';
import { LlmMessage } from '../../../llm/models/LlmMessage.js';
import { IMemoryService } from '../../../llm/services/IMemoryService.js';
import { IInputChatMessageFilter } from '../../IInputChatMessageFilter.js';

export class DiscordMemoryInputFilter implements IInputChatMessageFilter<DiscordMessage> {
  readonly #memoryService: IMemoryService;

  constructor(services: IBotServiceContainer) {
    this.#memoryService = services.getMemoryService();
  }

  async process(llmChatMessage: LlmChatMessage, chatMessage: DiscordMessage, context: LlmMessage[]): Promise<LlmMessage[]> {
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