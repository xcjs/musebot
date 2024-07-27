import {
    ButtonInteraction,
    Events,
    Message
} from 'discord.js';
import {Logger, LogLevel } from 'meklog';

import { EasyDiffusionClient } from '../../easy-diffusion/EasyDiffusionClient.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { DiscordPresenceStatus } from '../enums/DiscordPresenceStatus.js';
import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { BaseDiscordClient } from '../BaseDiscordClient.js';
import { TaskQueue } from '../../../tasks/services/TaskQueue.js';
import { PromptRenderTask } from '../../easy-diffusion/tasks/PromptRenderTask.js';
import { EasyDiffusionReplyService } from './EasyDiffusionReplyService.js';
import { FeatureService } from '../../../features/FeatureService.js';
import { RetryRenderTask } from '../../easy-diffusion/tasks/RetryRenderTask.js';
import { ShowSourceTask } from '../../easy-diffusion/tasks/ShowSourceTask.js';
import { DecreaseGuidanceScaleRenderTask } from '../../easy-diffusion/tasks/DecreaseGuidanceScaleRenderTask.js';
import { IncreaseGuidanceScaleRenderTask } from '../../easy-diffusion/tasks/IncreaseGuidanceScaleRenderTask.js';
import { RandomRenderTask } from '../../easy-diffusion/tasks/RandomRenderTask.js';

export class DiscordEasyDiffusionClient extends BaseDiscordClient {
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;

    constructor(
        environmentSettings: EnvironmentSettings,
        taskQueue: TaskQueue,
        featureService: FeatureService) {
        super(environmentSettings, taskQueue);

        this.environmentSettings = environmentSettings;
        this.#easyDiffusionClient = new EasyDiffusionClient(environmentSettings);
        this.#easyDiffusionReplyService = new EasyDiffusionReplyService(environmentSettings, this.#easyDiffusionClient, featureService);

        this.logger = new Logger(this.environmentSettings.isProduction, 'DiscordEasyDiffusionClient');

        this.#registerEvents();
    }

    login() {
        this.logger(LogLevel.Info, 'Performing client login...');
        this.client.login(this.environmentSettings.discordToken);
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.client.once(Events.ClientReady, (event) => this.#onClientReady.call(self, event));
        this.client.on(Events.MessageCreate, async (message) => await this.#onMessageCreate.call(self, message));
        this.client.on(Events.InteractionCreate, async (interaction) => await this.#onInteraction.call(self, interaction));
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

        if(!this.replyService.shouldReply(message)) {
            this.logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.logger(LogLevel.Info, 'Replying to message...');

        await this.typingService.startTyping(message);

        await this.taskQueue.add(new PromptRenderTask(
            this.environmentSettings,
            this.client,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            message,
            this.taskQueue));
    }

    async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, `Beginning interaction response to custom action ${interaction.customId}...`);

        await interaction.deferReply();
        await this.typingService.startTyping(interaction);

        switch(interaction.customId) {
            case BotInteraction.Retry:
                await this.#retry(interaction);
                break;
            case BotInteraction.ShowSource:
                await this.#showSource(interaction);
                break;
            case BotInteraction.GuidanceScaleMinus:
                await this.#decreaseGuidanceScale(interaction);
                break;
            case BotInteraction.GuidanceScalePlus:
                await this.#increaseGuidanceScale(interaction);
                break;
            case BotInteraction.Randomize:
                await this.#randomize(interaction);
                break;
            default:
                this.logger(LogLevel.Warning, `An unknown interaction was passed: ${interaction.customId}.`);
                break;
        }
    }

    async #retry(interaction: ButtonInteraction): Promise<void> {
        await this.taskQueue.add(new RetryRenderTask(
            this.environmentSettings,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            interaction));
    }

    async #showSource(interaction: ButtonInteraction): Promise<void> {
        await this.taskQueue.add(new ShowSourceTask(
            this.environmentSettings,
            this.#easyDiffusionReplyService,
            interaction));
    }

    async #decreaseGuidanceScale(interaction: ButtonInteraction): Promise<void> {
        await this.taskQueue.add(new DecreaseGuidanceScaleRenderTask(
            this.environmentSettings,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            interaction));
    }

    async #increaseGuidanceScale(interaction: ButtonInteraction): Promise<void> {
        await this.taskQueue.add(new IncreaseGuidanceScaleRenderTask(
            this.environmentSettings,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            interaction));
    }

    async #randomize(interaction: ButtonInteraction) {
        await this.taskQueue.add(new RandomRenderTask(
            this.environmentSettings,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            interaction));
    }
}
