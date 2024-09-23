import {
    ButtonInteraction,
    Client as DiscordClient,
    Events,
    Message
} from 'discord.js';
import {Logger, LogLevel } from 'meklog';

import { DiscordPresenceStatus } from '../enums/DiscordPresenceStatus.js';
import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { BaseDiscordClient } from '../BaseDiscordClient.js';
import { PromptRenderTask } from '../../easy-diffusion/tasks/PromptRenderTask.js';
import { RetryRenderTask } from '../../easy-diffusion/tasks/RetryRenderTask.js';
import { ShowSourceTask } from '../../easy-diffusion/tasks/ShowSourceTask.js';
import { DecreaseGuidanceScaleRenderTask } from '../../easy-diffusion/tasks/DecreaseGuidanceScaleRenderTask.js';
import { IncreaseGuidanceScaleRenderTask } from '../../easy-diffusion/tasks/IncreaseGuidanceScaleRenderTask.js';
import { RandomRenderTask } from '../../easy-diffusion/tasks/RandomRenderTask.js';
import { UpscaleRenderTask } from '../../easy-diffusion/tasks/UpscaleRenderTask.js';
import { ExpandPromptTask } from '../../easy-diffusion/tasks/ExpandPromptTask.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ReplyService } from '../services/ReplyService.js';
import { TaskQueue } from '../../../tasks/services/TaskQueue.js';
import { TypingService } from '../services/TypingService.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';

export class DiscordEasyDiffusionClient extends BaseDiscordClient {
    #services: IServiceContainer;

    #environmentSettings: EnvironmentSettings;
    #discordClient: DiscordClient;
    #replyService: ReplyService;
    #typingService: TypingService;
    #taskQueue: TaskQueue;

    constructor(services: IServiceContainer) {
        super(services);
        this.#services = services;

        this.#discordClient = services.discordClient;
        this.#replyService = services.replyService;
        this.#typingService = services.typingService;
        this.#taskQueue = services.taskQueue;

        this.logger = new Logger(this.#environmentSettings.isProduction, 'DiscordEasyDiffusionClient');

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

        this.#taskQueue.add(new PromptRenderTask(
            this.#services,
            message,
            this.#taskQueue));

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
        this.#taskQueue.add(new RetryRenderTask(
            this.#services,
            interaction));
    }

    #upscale(interaction: ButtonInteraction) {
        this.#taskQueue.add(new UpscaleRenderTask(
            this.#services,
            interaction));
    }

    #showSource(interaction: ButtonInteraction): void {
        this.#taskQueue.add(new ShowSourceTask(
            this.#services,
            interaction));
    }

    #decreaseGuidanceScale(interaction: ButtonInteraction): void {
        this.#taskQueue.add(new DecreaseGuidanceScaleRenderTask(
            this.#services,
            interaction));
    }

    #increaseGuidanceScale(interaction: ButtonInteraction): void {
        this.#taskQueue.add(new IncreaseGuidanceScaleRenderTask(
            this.#services,
            interaction));
    }

    #expandPrompt(interaction: ButtonInteraction): void {
        this.#taskQueue.add(new ExpandPromptTask(
            this.#services,
            interaction));
    }

    #randomize(interaction: ButtonInteraction) {
        this.#taskQueue.add(new RandomRenderTask(
            this.#services,
            interaction));
    }
}
