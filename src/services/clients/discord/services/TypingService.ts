import { ButtonInteraction, Message } from 'discord.js';
import {Logger, LogLevel } from 'meklog';
import { EnvironmentSettings } from '../../../../models/EnvironmentSettings';

export class TypingService {
    #environmentSettings: EnvironmentSettings;

    #logger;

    #sendTypingIntervalMilliseconds = 1000;
    #typingInterval: NodeJS.Timeout | null = null;

    #shouldBeTypingCallback: () => boolean;

    constructor(environmentSettings: EnvironmentSettings) {
        this.#environmentSettings = environmentSettings;
        this.#logger = new Logger(this.#environmentSettings.isProduction, 'TypingService');
    }

    async startTyping(message: Message | ButtonInteraction, shouldBeTypingCallback: () => boolean): Promise<void> {
        this.#shouldBeTypingCallback = shouldBeTypingCallback;

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
        if(this.#shouldBeTypingCallback()) {
            return;
        }

        if(this.#typingInterval !== null) {
            this.#logger(LogLevel.Info, `Stopped typing and clearing interval #${this.#typingInterval}.`);
            clearInterval(this.#typingInterval);
            this.#typingInterval = null;
        }
    }

    async #onTypingInterval(message: Message | ButtonInteraction): Promise<void> {
        console.log('Typing interval called.');

        if(this.#shouldBeTypingCallback()) {
            await message.channel.sendTyping();
        } else {
            this.#stopTyping();
        }
    }
}
