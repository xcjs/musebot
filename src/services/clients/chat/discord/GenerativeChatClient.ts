import { ButtonInteraction, Client as DiscordClient, Events, Message as DiscordMessage, MessageReaction, TextChannel,User } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { IEnvironmentSettings } from '../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { IContextMessageFactory } from '../../llm/services/IContextMessageFactory.js';
import { IContextService } from '../../llm/services/IContextService.js';
import { IReplyService } from '../IReplyService.js';
import { ITypingService } from '../ITypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';
import { ChatConfirmClearActionRow } from './components/buttonRows/ChatConfirmClearActionRow.js';

export class GenerativeChatClient extends BaseDiscordClient {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #contextMessageFactory: IContextMessageFactory<DiscordMessage, OllamaMessage>;
    #contextService: IContextService<DiscordMessage, OllamaMessage>;
    #typingService: ITypingService;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #channelTopicsCached: string[] = [];

    constructor(services: IServiceContainer) {
        super(services);
        this.logger = services.getLogger('GenerativeChatClient');

        this.#services = services;
        this.#environmentSettings = services.environmentSettings;
        this.#contextMessageFactory = services.getContextMessageFactory<DiscordMessage, OllamaMessage>();
        this.#contextService = services.getContextService<DiscordMessage, OllamaMessage>();
        this.#discordClient = services.discordClient;
        this.#typingService = services.typingService;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        const systemPrompt = this.#environmentSettings.ollamaSystemPrompt;
        this.#contextService.addContext([this.#contextMessageFactory.fromSystemPrompt(systemPrompt, null, true)]);

        this.#registerEvents();
    }

    #registerEvents(): void {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.#discordClient.once(Events.ClientReady, (event) => void this.onClientReady.call(self, event));
        this.#discordClient.on(Events.MessageCreate, (message) => void this.#onMessageCreate.call(self, message));
        this.#discordClient.on(Events.InteractionCreate, (interaction) => void  this.#onInteraction.call(self, interaction));
        this.#discordClient.on(Events.MessageReactionAdd, (reaction, user) => void this.#onMessageReactionAdd.call(self, reaction, user));
    }

    async #onMessageCreate(message: DiscordMessage): Promise<void> {
        this.logger.info(`Discord message created. ${message.author.displayName} (${message.author.username}): "${message.content}"`);

        if(!this.#replyService.shouldReply(message, null)) {
            return;
        }

        if(message.guildId !== null
            && !this.#channelTopicsCached.find(x => x === message.channelId)) {
            this.#contextService.addContext([this.#contextMessageFactory.fromSystemPrompt((message.channel as TextChannel).topic, message.channelId, false)]);
            this.#channelTopicsCached.push(message.channelId);
        }

        this.logger.info('Replying to message...');
        const messageTask = this.#services.getMessageTask(message) as BaseTask<OllamaMessage[]>;
        this.#taskQueue.add(messageTask);
        await this.#typingService.startTyping(message);
    }

     async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger.info('Beginning interaction response to custom action:', interaction);

        try {
            await interaction.deferReply();
        } catch(error) {
            this.logger.error('An error occurred while deferring a reply. Ignore this error if the bot is functioning normally:', error);
        }

        await this.#typingService.startTyping(interaction);

        switch(interaction.customId) {
            case BotInteraction.ClearContext.toString():
                await this.#clearContextAskConfirmation(interaction);
                break;
            case BotInteraction.ClearContextCancel.toString():
                await this.#clearContextCancel(interaction);
                break;
            case BotInteraction.ClearContextConfirm.toString():
                await this.#clearContext(interaction);
                break;
            case BotInteraction.Help.toString():
                this.#taskQueue.add(this.#services.getInteractionTask(interaction));
                break;
            default:
                this.logger.warn('An unknown interaction was passed:', interaction);
                break;
        }
     }

    async #clearContextAskConfirmation(interaction: ButtonInteraction): Promise<void> {
        this.logger.info('Asking confirmation before clearing the large language model context...');

        try {
            await interaction.editReply({
                content: `Are you sure you want to clear the conversational context of `
                    + `${this.#contextService.getContextByChannelId(interaction.channelId).length} messages?`
                    + ` This will make me forget everything we've discussed up to this point.`,
                components: new ChatConfirmClearActionRow(this.#services).build()
            });
        } catch {
            this.logger.error('An error occurred while asking to clear the Ollama context.');
        }
     }

     async #clearContext(interaction: ButtonInteraction): Promise<void> {
        this.logger.info('Clearing the large language model context...');
        this.#contextService.clearContext(interaction.channelId);
        this.#channelTopicsCached = [];

        try{
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            await interaction.editReply(`The conversational context has been cleared - ${interaction.member?.user.toString() ?? 'you'} just gave an AI amnesia!`);
            await interaction.message.delete();
        } catch(error) {
            this.logger.error('An error occurred while clearing the Ollama context: ', error);
        }
     }

    async #clearContextCancel(interaction: ButtonInteraction): Promise<void> {
         this.logger.info('Cancelling clearing the large language model context...');

        try {
            await interaction.message.delete();
            await interaction.editReply('Cancelling...');
            await interaction.deleteReply();
        } catch(error) {
            this.logger.error('An error occurred while cancelling clearing the Ollama context: ', error);
        }
     }

    async #onMessageReactionAdd(reaction: MessageReaction, user: User): Promise<void> {
        if (reaction.partial) {
            try {
                reaction = await reaction.fetch();
            } catch (error) {
                this.logger.error('An error occurred while fetching the MessageReaction:', error);
                return;
            }
        }

        if (!this.#replyService.shouldReply(reaction.message as DiscordMessage, reaction)) {
            return;
        }

        const emojiReactionTask = this.#services.getEmojiReactionTask(reaction, user);
        this.#taskQueue.add(emojiReactionTask as BaseTask<OllamaMessage[]>);
        await this.#typingService.startTyping(reaction.message as DiscordMessage);
    }
}
