import { ButtonInteraction, Events, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BaseDiscordClient } from '../BaseDiscordClient.js';
import { DiscordPresenceStatus } from '../enums/DiscordPresenceStatus.js';
import { PromptResponseTask } from '../../ollama/tasks/PromptResponseTask.js';
import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { IServiceContainer } from '../../../IServiceContainer.js';

export class DiscordOllamaClient extends BaseDiscordClient {
    #services: IServiceContainer;

    #context: Array<number> = [];

    constructor(services: IServiceContainer) {
        super(services);

        this.logger = new Logger(this.#services.environmentSettings.isProduction, 'DiscordOllamaClient');

        this.#registerEvents();
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.#services.discordClient.once(Events.ClientReady, (event) => this.#onClientReady.call(self, event));
        this.#services.discordClient.on(Events.MessageCreate, async (message) => await this.#onMessageCreate.call(self, message));
        this.#services.discordClient.on(Events.InteractionCreate, async (interaction) => await this.#onInteraction.call(self, interaction));
    }

    #onClientReady(): Promise<void> {
        if (this.#services.discordClient.user === null) {
            return;
        }

        this.logger(LogLevel.Info, 'Client is ready.');
        this.#services.discordClient.user.setPresence({ activities: [], status: DiscordPresenceStatus.Online });
    }

    async #onMessageCreate(message: Message): Promise<void> {
        this.logger(LogLevel.Info, `Discord message created. ${message.author.displayName} (${message.author.username}): "${message}"`);

        if(!this.#services.replyService.shouldReply(message)) {
            this.logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.logger(LogLevel.Info, 'Replying to message...');

        const promptResponseTask = new PromptResponseTask(
            this.#services,
            message,
            this.#context);

            promptResponseTask.onSuccess = (context: Array<number>) => { this.#context = context; };

        this.#services.taskQueue.add(promptResponseTask);

        await this.#services.typingService.startTyping(message);
    }

     async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, `Beginning interaction response to custom action ${interaction.customId}...`);

        await interaction.deferReply();
        await this.#services.typingService.startTyping(interaction);

        switch(interaction.customId) {
            case BotInteraction.ClearContext:
                await this.#clearContext(interaction);
                break;
            default:
                this.logger(LogLevel.Warning, `An unknown interaction was passed: ${interaction.customId}.`);
                break;
        }
     }

     async #clearContext(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, 'Clearing the large language model context...');
        this.#context = [];

        try{
            await interaction.editReply(`The conversational context has been cleared - ${interaction.member} just gave an AI amnesia!`);
        } catch {
            this.logger(LogLevel.Error, 'An exception occurred while clearing the Ollama context.');
        }
     }
}
