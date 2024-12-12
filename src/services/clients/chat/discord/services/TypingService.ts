import { BaseGuildTextChannel, ButtonInteraction, Message } from 'discord.js';
import {Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { ITypingService } from '../../ITypingService.js';
import { IChannelTypingIndicator } from '../models/IChannelTypingIndicator.js';

export class TypingService implements ITypingService {
    #environmentSettings: IEnvironmentSettings;
    #taskQueue: ITaskQueue;

    #logger;

    #interaction: Message | ButtonInteraction | null = null;

    #sendTypingIntervalMilliseconds = 1000;
    #typingIntervals: Array<IChannelTypingIndicator> = [];

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;
        this.#taskQueue = services.taskQueue;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'TypingService');
    }

    async startTyping(interaction: Message | ButtonInteraction): Promise<void> {
        this.#interaction = interaction;

        let channelTypingIndicator = this.#typingIntervals.find(x => x.channelId === interaction.channelId);

        if (channelTypingIndicator !== undefined
            && channelTypingIndicator.typingInterval !== null) {
            return;
        } else {
            channelTypingIndicator = {
                channelId: interaction.channelId,
                typingInterval: null
            };

            this.#typingIntervals.push(channelTypingIndicator);
        }

        try {
            await this.#onTypingInterval(interaction);

            channelTypingIndicator.typingInterval = setInterval(async () => {
                await this.#onTypingInterval(interaction);
            }, this.#sendTypingIntervalMilliseconds);

            this.#logger(LogLevel.Info, `Registered typing interval as interval #${channelTypingIndicator.typingInterval}.`);
        } catch(error) {
            this.#logger(LogLevel.Error, `An error occurred while sending the typing status: ${error}`);
            this.#stopTyping();
        }
    }

    #stopTyping(): void {
        if(this.#interaction === null) {
            return;
        }

        const channelTypingIndicator = this.#typingIntervals.find(x => x.channelId === this.#interaction.channelId);

        if(channelTypingIndicator === undefined) {
            return;
        }

        if (this.#taskQueue.isActive || channelTypingIndicator.typingInterval === null) {
            return;
        }

        this.#logger(LogLevel.Info, `Stopped typing and clearing interval #${channelTypingIndicator.typingInterval}.`);
        clearInterval(channelTypingIndicator.typingInterval);
        channelTypingIndicator.typingInterval = null;
    }

    async #onTypingInterval(message: Message | ButtonInteraction): Promise<void> {
        if(this.#taskQueue.isActive && message.channel instanceof BaseGuildTextChannel) {
            await message.channel.sendTyping();
        } else {
            this.#stopTyping();
        }
    }
}
