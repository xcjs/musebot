import {
    ButtonInteraction,
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

export class DiscordEasyDiffusionClient extends BaseDiscordClient {
    #services: IServiceContainer;

    constructor(services: IServiceContainer) {
        super(services);
        this.#services = services;

        this.logger = new Logger(this.#services.environmentSettings.isProduction, 'DiscordEasyDiffusionClient');

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

        if(!this.replyService.shouldReply(message)) {
            this.logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.logger(LogLevel.Info, 'Replying to message...');

        this.taskQueue.add(new PromptRenderTask(
            this.environmentSettings,
            this.client,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            this.replyService,
            message,
            this.taskQueue));

        await this.typingService.startTyping(message);
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

        await this.#services.typingService.startTyping(interaction);
    }

    #retry(interaction: ButtonInteraction): void {
        this.taskQueue.add(new RetryRenderTask(
            this.environmentSettings,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            this.#messageService,
            this.replyService,
            interaction));
    }

    #upscale(interaction: ButtonInteraction) {
        this.taskQueue.add(new UpscaleRenderTask(
            this.environmentSettings,
            this.#easyDiffusionReplyService,
            this.#messageService,
            this.replyService,
            interaction
        ));
    }

    #showSource(interaction: ButtonInteraction): void {
        this.taskQueue.add(new ShowSourceTask(
            this.environmentSettings,
            this.#easyDiffusionReplyService,
            this.#messageService,
            this.replyService,
            interaction));
    }

    #decreaseGuidanceScale(interaction: ButtonInteraction): void {
        this.taskQueue.add(new DecreaseGuidanceScaleRenderTask(
            this.environmentSettings,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            this.#messageService,
            this.replyService,
            interaction));
    }

    #increaseGuidanceScale(interaction: ButtonInteraction): void {
        this.taskQueue.add(new IncreaseGuidanceScaleRenderTask(
            this.environmentSettings,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            this.#messageService,
            this.replyService,
            interaction));
    }

    #expandPrompt(interaction: ButtonInteraction): void {
        this.taskQueue.add(new ExpandPromptTask(
            this.environmentSettings,
            this.#ollamaClient,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            this.#messageService,
            this.replyService,
            this.taskQueue,
            interaction));
    }

    #randomize(interaction: ButtonInteraction) {
        this.taskQueue.add(new RandomRenderTask(
            this.environmentSettings,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            this.replyService,
            interaction));
    }
}
