import { Events, Message, MessageType } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../models/EnvironmentSettings.js';
import { TypingService } from './services/TypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';
import { DiscordPresenceStatus } from './enums/DiscordPresenceStatus.js';
import { JavaScriptType } from '../../../enums/JavaScriptType.js';
import { OllamaClient } from '../ollama/OllamaClient.js';
import { DiscordConstants } from './enums/DiscordConstants.js';

export class DiscordOllamaClient extends BaseDiscordClient {
    ollamaClients: Array<OllamaClient> = [];

    #context: Array<Array<number>> = [];

    constructor(environmentSettings: EnvironmentSettings, typingService: TypingService) {
        super(environmentSettings, typingService);

        this.environmentSettings = environmentSettings;
        this.typingService = typingService;

        this.logger = new Logger(this.environmentSettings.isProduction, 'DiscordOllamaClient');

        this.#registerEvents();
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.client.once(Events.ClientReady, (event) => this.#onClientReady.call(self, event));
        this.client.on(Events.MessageCreate, async (message) => await this.#onMessageCreate.call(self, message));
    }

    #onClientReady(): Promise<void> {
        if(this.client.user === null) {
            return;
        }

        this.logger(LogLevel.Info, 'Client is ready.');
        this.client.user.setPresence({ activities: [], status: DiscordPresenceStatus.Online });
    }

    async #onMessageCreate(message: Message): Promise<void> {
        this.logger(LogLevel.Info, `Discord message created. ${message.author.displayName} (${message.author.username}): "${message}"`);

        if(!this.#shouldReply(message)) {
            this.logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.logger(LogLevel.Info, 'Replying to message...');
        await this.#reply(message);
    }

    #shouldReply(message: Message): boolean {
        const shouldReply =
            !message.system         // Not a system message.
            && !!message.guild      // The message should be from a guild (server).
            && message.type === MessageType.Default // The message is a default message type.
            && !!message.author.id  // The message should have an author.
            && !message.author.bot  // No messages by bots.
            && !!message.mentions.members?.find(x => x.id === this.client.user?.id) // The message explicitly tags this bot.
            && message.author.id !== this.client.user?.id // No messages by this bot.
            && (
                this.environmentSettings.discordChannels.length === 0
                || this.environmentSettings.discordChannels.includes(message.channel.id)) // The channel is in the configured whitelist if there is one.
            && typeof message.content === JavaScriptType.String  // Only respond to text-based messages.
            && message.content.length > 0;                       // Only respond to messages with more than 0 characters.

        return shouldReply;
    }

    async #reply(message: Message): Promise<void> {
        const ollamaClient = new OllamaClient(this.environmentSettings);
        this.ollamaClients.push(ollamaClient);

        const context = this.#context.flat();

        const botMention = message.mentions.members.find(x => x.id === this.client.user?.id)?.toString() || '';

        const formattedMessage = `${message.author.displayName}: ${message.content.replaceAll(botMention, '')}`;

        await this.typingService.startTyping(message, () => DiscordOllamaClient.shouldBeTyping(this));

        const exchange = await ollamaClient.sendMessage(formattedMessage, context);
        const responses = this.#splitResponse(exchange.response.response);

        responses.forEach(async response => {
            await message.reply(response);
        });

        this.#context.push(exchange.response.context);
    }

    #splitResponse(response: string): Array<string> {
        const responses: Array<string> = [];

        while(response.length > 0) {
            if(response.length <= DiscordConstants.ContentMaxLength) {
                responses.push(response);
                return responses;
            }

            const splitPosition = response.substring(0, DiscordConstants.ContentMaxLength).lastIndexOf(' ');
            responses.push(response.substring(0, splitPosition));

            response = response.substring(splitPosition);
        }

        return responses;
    }

    static shouldBeTyping(client: DiscordOllamaClient): boolean {
        client.ollamaClients = client.ollamaClients.filter(x => x.isBusy);
        return client.ollamaClients.length > 0;
    }
}
