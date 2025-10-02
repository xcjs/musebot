import { Message as DiscordMessage } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { IServiceContainer } from '../../../../IServiceContainer.js';
import { OllamaRole } from '../../../llm/ollama/enums/OllamaRole.js';
import { ContextMessage } from '../../../llm/ollama/models/ContextMessage.js';
import { IContextMessageFactory } from '../../../llm/services/IContextMessageFactory.js';
import { IReplyService } from '../../IReplyService.js';

export class DiscordOllamaContextMessageFactory implements IContextMessageFactory<DiscordMessage, OllamaMessage> {
    #replyService: IReplyService;

    constructor(services: IServiceContainer) {
        this.#replyService = services.replyService;
    }

    fromSystemContext(context: string): ContextMessage<DiscordMessage, OllamaMessage> {
        const ollamaMessage: OllamaMessage = {
            role: OllamaRole.System,
            content: context
        };

        return {
            messageId: null,
            channelId: null,
            serverId: null,
            userId: null,
            chatMessage: null,
            timestamp: new Date(),
            llmMessage: ollamaMessage,
            keepInContext: true
        };
    }

    fromDiscordMessage(discordMessage: DiscordMessage): ContextMessage<DiscordMessage, OllamaMessage> {
        const ollamaMessage: OllamaMessage = {
            role: OllamaRole.User,
            content: `${discordMessage.author.displayName}: ${this.#replyService.getMessageWithoutBotMentions(discordMessage)}`
        }

        return {
            messageId: discordMessage.id,
            channelId: discordMessage.channelId,
            serverId: discordMessage.guildId,
            userId: discordMessage.author.id,
            timestamp: new Date(),
            chatMessage: discordMessage,
            llmMessage: ollamaMessage,
            keepInContext: false
        } as ContextMessage<DiscordMessage, OllamaMessage>;
    }
}
