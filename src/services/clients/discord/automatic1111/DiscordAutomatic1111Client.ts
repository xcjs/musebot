import {
    ButtonInteraction,
    Events,
    Message
} from 'discord.js';
import {Logger, LogLevel } from 'meklog';

import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { DiscordPresenceStatus } from '../enums/DiscordPresenceStatus.js';
import { BaseDiscordClient } from '../BaseDiscordClient.js';
import { TaskQueue } from '../../../tasks/services/TaskQueue.js';
import { FeatureService } from '../../../features/FeatureService.js';
import { ReplyService } from '../services/ReplyService.js';
import { TypingService } from '../services/TypingService.js';
import { Automatic1111Client } from '../../automatic1111/Automatic1111Client.js';
import { Automatic1111ReplyService } from './Automatic1111ReplyService.js';
import { PromptRenderTask } from '../../automatic1111/tasks/PromptRenderTask.js';
import { MessageService } from '../services/MessageService.js';
import { RetryRenderTask } from '../../automatic1111/tasks/RetryRenderTask.js';
import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { ShowSourceTask } from '../../automatic1111/tasks/ShowSourceTask.js';

export class DiscordAutomatic1111Client extends BaseDiscordClient {
    #automatic1111Client: Automatic1111Client;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #messageService: MessageService;
    #replyService: ReplyService;

    constructor(
        environmentSettings: EnvironmentSettings,
        featureService: FeatureService,
        messageService: MessageService,
        taskQueue: TaskQueue,
        typingService: TypingService
        ) {
        super(environmentSettings, featureService, taskQueue, typingService);

        this.#messageService = messageService;

        this.#resetTransitiveServices();
        this.#replyService = new ReplyService(environmentSettings, this.client);

        this.logger = new Logger(this.environmentSettings.isProduction, 'DiscordAutomatic1111Client');

        this.#registerEvents();
    }

    #resetTransitiveServices() {
        this.logger(LogLevel.Info, 'Resetting transitive services...');

        this.#automatic1111Client = new Automatic1111Client(this.environmentSettings);
        this.#automatic1111ReplyService = new Automatic1111ReplyService(
            this.environmentSettings,
            this.featureService,
            this.#automatic1111Client);
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

        this.#resetTransitiveServices();

        this.logger(LogLevel.Info, 'Replying to message...');

        this.taskQueue.add(new PromptRenderTask(
            this.environmentSettings,
            this.client,
            this.#automatic1111Client,
            this.#automatic1111ReplyService,
            this.#replyService,
            message));

        await this.typingService.startTyping(message);
    }

    async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, `Beginning interaction response to custom action ${interaction.customId}...`);

        this.#resetTransitiveServices();

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

        await this.typingService.startTyping(interaction);
    }

    #retry(interaction: ButtonInteraction): void {
        this.taskQueue.add(new RetryRenderTask(
            this.environmentSettings,
            this.#automatic1111Client,
            this.#automatic1111ReplyService,
            this.#messageService,
            this.#replyService,
            interaction));
    }

    #upscale(interaction: ButtonInteraction) {
        console.log(interaction);
    }

    #showSource(interaction: ButtonInteraction): void {
        this.taskQueue.add(new ShowSourceTask(
            this.environmentSettings,
            this.#automatic1111ReplyService,
            this.#messageService,
            this.#replyService,
            interaction
        ));
    }

    #decreaseGuidanceScale(interaction: ButtonInteraction): void {
        console.log(interaction);
    }

    #increaseGuidanceScale(interaction: ButtonInteraction): void {
        console.log(interaction);
    }

    #expandPrompt(interaction: ButtonInteraction): void {
        console.log(interaction);
    }

    #randomize(interaction: ButtonInteraction) {
        console.log(interaction);
    }
}
