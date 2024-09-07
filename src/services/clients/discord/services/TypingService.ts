import { BaseGuildTextChannel, ButtonInteraction, Message } from 'discord.js';
import {Logger, LogLevel } from 'meklog';
import { EnvironmentSettings } from '../../../EnvironmentSettings';
import { TaskQueue } from '../../../tasks/services/TaskQueue';

export class TypingService {
    #environmentSettings: EnvironmentSettings;
    #taskQueue: TaskQueue;

    #logger;

    #sendTypingIntervalMilliseconds = 1000;
    #typingInterval: NodeJS.Timeout | null = null;

    constructor(environmentSettings: EnvironmentSettings, taskQueue: TaskQueue) {
        this.#environmentSettings = environmentSettings;
        this.#taskQueue = taskQueue;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'TypingService');
    }

    async startTyping(message: Message | ButtonInteraction): Promise<void> {
        if(this.#typingInterval !== null) {
            return;
        }

        try {
            await this.#onTypingInterval(message);

            this.#typingInterval = setInterval(async () => {
                await this.#onTypingInterval(message);
            }, this.#sendTypingIntervalMilliseconds);

            this.#logger(LogLevel.Info, `Registered typing interval as interval #${this.#typingInterval}.`);
        } catch(error) {
            this.#logger(LogLevel.Error, `An error occurred while sending the typing status: ${error}`);
            this.#stopTyping();
        }
    }

    #stopTyping(): void {
        if(this.#taskQueue.isActive || this.#typingInterval === null) {
            return;
        }

        this.#logger(LogLevel.Info, `Stopped typing and clearing interval #${this.#typingInterval}.`);
        clearInterval(this.#typingInterval);
        this.#typingInterval = null;
    }

    async #onTypingInterval(message: Message | ButtonInteraction): Promise<void> {
        if(this.#taskQueue.isActive && message.channel instanceof BaseGuildTextChannel) {
            await message.channel.sendTyping();
        } else {
            this.#stopTyping();
        }
    }
}
