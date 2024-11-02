import { ButtonInteraction, Client as DiscordClient, Events, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { splitText } from '../../../../utilities/string-utilities.js';
import { IHelpService } from '../../../help/IHelpService.js';
import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { IReplyService } from '../IReplyService.js';
import { ITypingService } from '../ITypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';
import { DiscordConstants } from './enums/DiscordConstants.js';
import { DiscordPresenceStatus } from './enums/DiscordPresenceStatus.js';

export class GenerativeTextChatClient extends BaseDiscordClient {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #typingService: ITypingService;
    #replyService: IReplyService;
    #helpService: IHelpService;
    #taskQueue: ITaskQueue;

    #context: Array<number> = [];

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#typingService = services.typingService;
        this.#replyService = services.replyService;
        this.#helpService = services.helpService;
        this.#taskQueue = services.taskQueue;

        this.logger = new Logger(this.#environmentSettings.isProduction, 'GenerativeTextChatClient');

        this.#registerEvents();
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.#discordClient.once(Events.ClientReady, (event) => this.#onClientReady.call(self, event));
        this.#discordClient.on(Events.MessageCreate, async (message) => await this.#onMessageCreate.call(self, message));
        this.#discordClient.on(Events.InteractionCreate, async (interaction) => await this.#onInteraction.call(self, interaction));
    }

    #onClientReady(): Promise<void> {
        if (this.#discordClient.user === null) {
            return;
        }

        this.logger(LogLevel.Info, 'Client is ready.');
        this.#discordClient.user.setPresence({ activities: [], status: DiscordPresenceStatus.Online });
    }

    async #onMessageCreate(message: Message): Promise<void> {
        this.logger(LogLevel.Info, `Discord message created. ${message.author.displayName} (${message.author.username}): "${message}"`);

        if(!this.#replyService.shouldReply(message)) {
            this.logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.logger(LogLevel.Info, 'Replying to message...');

        const promptResponseTask = this.#services.getPromptResponseTask(message, this.#context) as BaseTask;
        promptResponseTask.onSuccess = (context: Array<number>) => { this.#context = context; };

        this.#taskQueue.add(promptResponseTask);

        await this.#typingService.startTyping(message);
    }

     async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, `Beginning interaction response to custom action ${interaction.customId}...`);

        await interaction.deferReply();
        await this.#typingService.startTyping(interaction);

        switch(interaction.customId) {
            case BotInteraction.ClearContext:
                await this.#clearContext(interaction);
                break;
            case BotInteraction.Help:
                const replies = splitText(this.#helpService.buildHelpArticle(), DiscordConstants.ContentMaxLength);

                replies.forEach(async reply => {
                    await interaction.reply(reply);
                });

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
