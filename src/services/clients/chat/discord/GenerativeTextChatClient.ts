import { ButtonInteraction, Client as DiscordClient, Events, Message, MessageReaction, User } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { IHelpService } from '../../../help/IHelpService.js';
import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { IReplyService } from '../IReplyService.js';
import { ITypingService } from '../ITypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';
import { LargeLanguageModelConfirmClearActionRow } from './components/buttonRows/LargeLanguageModelConfirmClearActionRow.js';

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

        this.#discordClient.once(Events.ClientReady, (event) => this.onClientReady.call(self, event));
        this.#discordClient.on(Events.MessageCreate, async (message) => await this.#onMessageCreate.call(self, message));
        this.#discordClient.on(Events.InteractionCreate, async (interaction) => await this.#onInteraction.call(self, interaction));
        this.#discordClient.on(Events.MessageReactionAdd, async (reaction, user) => await this.#onMessageReactionAdd.call(self, reaction, user));
    }

    async #onMessageCreate(message: Message): Promise<void> {
        this.logger(LogLevel.Info, `Discord message created. ${message.author.displayName} (${message.author.username}): "${message}"`);

        if(!this.#replyService.shouldReply(message, false)) {
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

        try {
            await interaction.deferReply();
        } catch(error) {
            this.logger(LogLevel.Error, `Something went wrong while deferring a reply: ${error}. Ignore this error if the bot is functioning normally.`);
        }

        await this.#typingService.startTyping(interaction);

        switch(interaction.customId) {
            case BotInteraction.ClearContext:
                await this.#clearContextAskConfirmation(interaction);
                break;
            case BotInteraction.ClearContextCancel:
                await this.#clearContextCancel(interaction);
                break;
            case BotInteraction.ClearContextConfirm:
                await this.#clearContext(interaction);
                break;
            case BotInteraction.Help:
                this.#taskQueue.add(this.#services.getReplyTask(
                    interaction,
                    this.#helpService.buildHelpArticle(interaction),
                    []) as BaseTask);
                break;
            default:
                this.logger(LogLevel.Warning, `An unknown interaction was passed: ${interaction.customId}.`);
                break;
        }
     }

    async #clearContextAskConfirmation(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, 'Asking confirmation before clearing the large language model context...');

        try {
            await interaction.editReply({
                content: `Are you sure you want to clear the conversational context of ${this.#context.length} tokens?`
                    + ` This will make me forget everything we've discussed up to this point.`,
                components: new LargeLanguageModelConfirmClearActionRow(this.#services).build()
            });
        } catch {
            this.logger(LogLevel.Error, 'An error occurred while asking to clear the Ollama context.');
        }
     }

     async #clearContext(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, 'Clearing the large language model context...');
        this.#context = [];

        try{
            await interaction.editReply(`The conversational context has been cleared - ${interaction.member} just gave an AI amnesia!`);
            await interaction.message.delete();
        } catch {
            this.logger(LogLevel.Error, 'An error occurred while clearing the Ollama context.');
        }
     }

    async #clearContextCancel(interaction: ButtonInteraction): Promise<void> {
         this.logger(LogLevel.Info, 'Asking confirmation before clearing the large language model context...');

        try {
            await interaction.editReply(`The conversational context has been cleared - ${interaction.member} just gave an AI amnesia!`);
        } catch {
            this.logger(LogLevel.Error, 'An error occurred while canceling clearing the Ollama context.');
        }
     }

    async #onMessageReactionAdd(reaction: MessageReaction, user: User): Promise<void> {
        if (reaction.partial) {
            try {
                reaction = await reaction.fetch();
            } catch (error) {
                this.logger(LogLevel.Error, `Something went wrong when fetching the MessageReaction: ${error}.`);
                return;
            }
        }

        if (!this.#replyService.shouldReply(reaction.message as Message, true)) {
            return;
        }

        const emojiResponseTask = this.#services.getEmojiResponseTask(reaction, user, this.#context);
        this.#taskQueue.add(emojiResponseTask as BaseTask);

        await this.#typingService.startTyping(reaction.message as Message);

        emojiResponseTask.onSuccess = (context: Array<number>) => { this.#context = context; };
    }
}
