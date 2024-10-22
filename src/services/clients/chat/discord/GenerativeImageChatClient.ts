import { ButtonInteraction, Client as DiscordClient, Events, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { IReplyService } from '../IReplyService.js';
import { ITypingService } from '../ITypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';
import { DiscordPresenceStatus } from './enums/DiscordPresenceStatus.js';

export class GenerativeImageChatClient extends BaseDiscordClient {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #replyService: IReplyService;
    #typingService: ITypingService;
    #taskQueue: ITaskQueue;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#replyService = services.replyService;
        this.#typingService = services.typingService;
        this.#taskQueue = services.taskQueue;

        this.logger = new Logger(this.#environmentSettings.isProduction, 'GenerativeImageChatClient');

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

        if (!this.#replyService.shouldReply(message)) {
            this.logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.logger(LogLevel.Info, 'Replying to message...');
        this.#taskQueue.add(this.#services.getPromptRenderTask(message) as BaseTask);

        await this.#typingService.startTyping(message);
    }

    async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, `Beginning interaction response to custom action ${interaction.customId}...`);

        await interaction.deferReply();

        switch (interaction.customId) {
            case BotInteraction.Retry:
                this.#taskQueue.add(this.#services.getRetryRenderTask(interaction) as BaseTask);
                break;
            case BotInteraction.Upscale:
                this.#taskQueue.add(this.#services.getUpscaleRenderTask(interaction) as BaseTask);
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
            default:
                this.logger(LogLevel.Warning, `An unknown interaction was passed: ${interaction.customId}.`);
                break;
        }

        await this.#typingService.startTyping(interaction);
    }
}
