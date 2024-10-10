import {
    ButtonInteraction,
    Client as DiscordClient,
    Events,
    Message
} from 'discord.js';
import {Logger, LogLevel } from 'meklog';

import { DiscordPresenceStatus } from '../enums/DiscordPresenceStatus.js';
import { BaseDiscordClient } from '../BaseDiscordClient.js';
import { TaskQueue } from '../../../tasks/services/TaskQueue.js';
import { TypingService } from '../services/TypingService.js';
import { PromptRenderTask } from '../../automatic1111/tasks/PromptRenderTask.js';
import { RetryRenderTask } from '../../automatic1111/tasks/RetryRenderTask.js';
import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { ShowSourceTask } from '../../automatic1111/tasks/ShowSourceTask.js';
import { DecreaseGuidanceScaleRenderTask } from '../../automatic1111/tasks/DecreaseGuidanceScaleRenderTask.js';
import { IncreaseGuidanceScaleRenderTask } from '../../automatic1111/tasks/IncreaseGuidanceScaleRenderTask.js';
import { ExpandPromptTask } from '../../automatic1111/tasks/ExpandPromptTask.js';
import { UpscaleRenderTask } from '../../automatic1111/tasks/UpscaleRenderTask.js';
import { RandomRenderTask } from '../../automatic1111/tasks/RandomRenderTask.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ReplyService } from '../services/ReplyService.js';
import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';

export class DiscordAutomatic1111Client extends BaseDiscordClient {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #replyService: ReplyService;
    #typingService: TypingService;
    #taskQueue: TaskQueue;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#replyService = services.replyService;
        this.#typingService = services.typingService;
        this.#taskQueue = services.taskQueue;

        this.logger = new Logger(this.#environmentSettings.isProduction, 'DiscordAutomatic1111Client');

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

        this.#taskQueue.add(new PromptRenderTask(this.#services, message));

        await this.#typingService.startTyping(message);
    }

    async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, `Beginning interaction response to custom action ${interaction.customId}...`);

        await interaction.deferReply();

        switch(interaction.customId) {
            case BotInteraction.Retry:
                this.#retry(interaction);
                break;
            case BotInteraction.Upscale:
                this.#upscale(interaction);
                break;
            case BotInteraction.ShowSource:
                this.#showSource(interaction);
                break;
            case BotInteraction.GuidanceScaleMinus:
                this.#decreaseGuidanceScale(interaction);
                break;
            case BotInteraction.GuidanceScalePlus:
                this.#increaseGuidanceScale(interaction);
                break;
            case BotInteraction.ExpandPrompt:
                this.#expandPrompt(interaction);
                break;
            case BotInteraction.Randomize:
                this.#randomize(interaction);
                break;
            default:
                this.logger(LogLevel.Warning, `An unknown interaction was passed: ${interaction.customId}.`);
                break;
        }

        await this.#typingService.startTyping(interaction);
    }

    #retry(interaction: ButtonInteraction): void {
        this.#taskQueue.add(new RetryRenderTask(this.#services, interaction));
    }

    #upscale(interaction: ButtonInteraction) {
        this.#taskQueue.add(new UpscaleRenderTask(this.#services, interaction));
    }

    #showSource(interaction: ButtonInteraction): void {
        this.#taskQueue.add(new ShowSourceTask(this.#services, interaction));
    }

    #decreaseGuidanceScale(interaction: ButtonInteraction): void {
       this.#taskQueue.add(new DecreaseGuidanceScaleRenderTask(this.#services, interaction));
    }

    #increaseGuidanceScale(interaction: ButtonInteraction): void {
        this.#taskQueue.add(new IncreaseGuidanceScaleRenderTask(this.#services, interaction));
    }

    #expandPrompt(interaction: ButtonInteraction): void {
        this.#taskQueue.add(new ExpandPromptTask(this.#services, interaction));
    }

    #randomize(interaction: ButtonInteraction) {
        this.#taskQueue.add(new RandomRenderTask(this.#services, interaction));
    }
}
