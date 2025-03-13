import { ButtonInteraction, Client as DiscordClient, Events, Message, MessageReaction, User } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { IEnvironmentSettings } from '../../../environment-settings/IEnvironmentSettings.js';
import { IHelpService } from '../../../help/IHelpService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { PromptExtensionType } from '../../images/enums/PromptExtensionType.js';
import { IReplyService } from '../IReplyService.js';
import { ITypingService } from '../ITypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';

export class GenerativeImageChatClient extends BaseDiscordClient {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #replyService: IReplyService;
    #typingService: ITypingService;
    #helpService: IHelpService;
    #taskQueue: ITaskQueue;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#replyService = services.replyService;
        this.#typingService = services.typingService;
        this.#helpService = services.helpService;
        this.#taskQueue = services.taskQueue;

        this.logger = new Logger(this.#environmentSettings.isProduction, 'GenerativeImageChatClient');

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

        if (!this.#replyService.shouldReply(message, false)) {
            return;
        }

        this.logger(LogLevel.Info, 'Replying to message...');
        this.#taskQueue.add(this.#services.getPromptRenderTask(message) as BaseTask);

        await this.#typingService.startTyping(message);
    }

    async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, `Beginning interaction response to custom action ${interaction.customId}...`);

        try {
            await interaction.deferReply();
        } catch (error) {
            this.logger(LogLevel.Error, `Something went wrong while deferring a reply: ${error}. Ignore this error if the bot is functioning normally.`);
        }

        switch (interaction.customId) {
            case BotInteraction.Retry:
                this.#taskQueue.add(this.#services.getRetryRenderTask(interaction, null, null, null) as BaseTask);
                break;
            case BotInteraction.UpscaleDetail:
                this.#taskQueue.add(this.#services.getUpscaleRenderTask(interaction) as BaseTask);
                break;
            case BotInteraction.UpscaleDesign:
                this.#taskQueue.add(this.#services.getUpscaleRenderTask(interaction) as BaseTask)
                break;
            case BotInteraction.ShowSource:
                this.#taskQueue.add(this.#services.getShowSourceTask(interaction) as BaseTask);
                break;
            case BotInteraction.GuidanceScaleMinus:
                this.#taskQueue.add(this.#services.getDecreaseGuidanceScaleRenderTask(interaction) as BaseTask);
                break;
            case BotInteraction.GuidanceScalePlus:
                this.#taskQueue.add(this.#services.getIncreaseGuidanceScaleRenderTask(interaction) as BaseTask);
                break;
            case BotInteraction.ExpandPrompt:
                this.#taskQueue.add(this.#services.getExpandPromptTask(interaction) as BaseTask);
                break;
            case BotInteraction.Randomize:
                this.#taskQueue.add(this.#services.getRandomRenderTask(interaction) as BaseTask);
                break;
            case BotInteraction.Help:
                this.#taskQueue.add(this.#services.getReplyTask(
                    interaction, {
                        content: this.#helpService.buildHelpArticle(interaction),
                    }) as BaseTask);
                break;
            default:
                this.logger(LogLevel.Warning, `An unknown interaction was passed: ${interaction.customId}.`);
                break;
        }

        await this.#typingService.startTyping(interaction);
    }

    async #onMessageReactionAdd(reaction: MessageReaction, user: User): Promise<void> {
        if(reaction.partial) {
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

        await this.#typingService.startTyping(reaction.message as Message);

        this.#taskQueue.add(this.#services.getRetryRenderTask(
            reaction.message as Message,
            reaction.emoji.name,
            PromptExtensionType.Emoji,
            user) as BaseTask);
    }
}
