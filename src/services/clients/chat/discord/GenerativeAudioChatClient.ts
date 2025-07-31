import { ButtonInteraction,Client as DiscordClient, Events, Message as DiscordMessage } from 'discord.js';

import { APPLICATION_NAME } from '../../../../constants/Globals.js';
import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { IHelpService } from '../../../help/IHelpService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { IReplyService } from '../IReplyService.js';
import { ITypingService } from '../ITypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';

export class GenerativeAudioChatClient extends BaseDiscordClient {
    #services: IServiceContainer;

    #discordClient: DiscordClient;
    #replyService: IReplyService;
    #typingService: ITypingService;
    #helpService: IHelpService;
    #taskQueue: ITaskQueue;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#discordClient = services.discordClient;
        this.#replyService = services.replyService;
        this.#typingService = services.typingService;
        this.#helpService = services.helpService;
        this.#taskQueue = services.taskQueue;

        this.logger = services.getLogger('GenerativeAudioChatClient');

        this.#registerEvents();
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.#discordClient.once(Events.ClientReady, (event) => void this.onClientReady.call(self, event));
        this.#discordClient.on(Events.MessageCreate, (message) => void this.#onMessageCreate.call(self, message));
        this.#discordClient.on(Events.InteractionCreate, (interaction) => void this.#onInteraction.call(self, interaction));
    }

    async #onMessageCreate(message: DiscordMessage): Promise<void> {
        this.logger.info('Discord message created:', message);

        if (!this.#replyService.shouldReply(message, null)) {
            return;
        }

        this.#taskQueue.add(this.#services.getReplyRenderTask(message) as BaseTask<void>);

        this.logger.info('Replying to message...');
        await this.#typingService.startTyping(message);
    }

    async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger.info('Beginning interaction response to custom action:', interaction);

        try {
            await interaction.deferUpdate();
        } catch (error) {
            this.logger.error(`Error while deferring a reply. Ignore this error if the ${APPLICATION_NAME} is functioning normally:`, error);
        }

        switch (interaction.customId) {
            case BotInteraction.Retry.toString():
                this.#taskQueue.add(this.#services.getRetryRenderTask(interaction) as BaseTask<void>);
                break;
            default:
                this.logger.warn('An unregistered interaction was received. This should not happen.');
                break;
        }

        await this.#typingService.startTyping(interaction);
    }
}
