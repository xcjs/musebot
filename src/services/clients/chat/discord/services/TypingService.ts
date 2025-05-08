import { BaseGuildTextChannel, ButtonInteraction, DMChannel, Message } from 'discord.js';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { ITypingService } from '../../ITypingService.js';
import { IChannelTypingIndicator } from '../models/IChannelTypingIndicator.js';

export class TypingService implements ITypingService {
    #environmentSettings: IEnvironmentSettings;
    #taskQueue: ITaskQueue;
    #logger: ILogger;

    #interaction: Message | ButtonInteraction | null = null;

    #sendTypingIntervalMilliseconds = 1000;
    #typingIndicators: Array<IChannelTypingIndicator> = [];

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;
        this.#taskQueue = services.taskQueue;

        this.#logger = services.getLogger('TypingService');
    }

    async startTyping(interaction: Message | ButtonInteraction): Promise<void> {
        this.#interaction = interaction;

        let channelTypingIndicator = this.#typingIndicators.find(x => x.channelId === interaction.channelId);

        if(channelTypingIndicator === undefined) {
            this.#logger.info(`No typing indicator for channel #${interaction.channelId} was found - creating a new one.`);

            channelTypingIndicator = {
                channelId: interaction.channelId,
                typingInterval: null
            };

            this.#typingIndicators.push(channelTypingIndicator);
        }

        if(channelTypingIndicator.typingInterval !== null) {
            this.#logger.info('This channel already has a typing indicator - skipping.');
            return;
        }

        try {
            await this.#onTypingInterval(interaction);

            channelTypingIndicator.typingInterval = setInterval(() => {
                void this.#onTypingInterval(interaction);
            }, this.#sendTypingIntervalMilliseconds);

            this.#logger.info(`Registered typing interval as interval #${channelTypingIndicator.typingInterval.ref.toString()}.`);
        } catch(error) {
            this.#logger.error(`An error occurred while sending the typing status: ${error}`);
            this.#stopTyping();
        }
    }

    #stopTyping(): void {
        if(this.#interaction === null) {
            this.#logger.warning('Cannot stop a typing indicator with no matching interaction.');
            return;
        }

        const channelTypingIndicator = this.#typingIndicators.find(x => x.channelId === this.#interaction.channelId);

        if (channelTypingIndicator === undefined || channelTypingIndicator.typingInterval === null) {
            this.#logger.warning('Cannot stop a typing indicator with no matching interval.');
            return;
        }

        if (this.#taskQueue.isActive) {
            this.#logger.warning('Cannot stop a typing indicator while the task queue is active.');
            return;
        }

        this.#logger.info(`StoppingStopped typing and clearing interval #${channelTypingIndicator.typingInterval.ref.toString()}.`);
        clearInterval(channelTypingIndicator.typingInterval);
        channelTypingIndicator.typingInterval = null;
    }

    async #onTypingInterval(message: Message | ButtonInteraction): Promise<void> {
        if(this.#taskQueue.isActive
            && (message.channel instanceof BaseGuildTextChannel
                || message.channel instanceof DMChannel
            )) {
            try {
                await message.channel.sendTyping();
            } catch(error) {
                this.#logger.error(`Something went wrong while setting the typing indicator: ${error}. Ignore this error if the bot is functioning normally.`);
            }
        } else {
            this.#stopTyping();
        }
    }
}
