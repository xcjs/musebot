import { Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { splitText } from '../../../../../utilities/string-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { LargeLanguageModelActionRow } from '../components/buttonRows/LargeLanguageModelActionRow.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class OllamaStreamingReplyService {
    #services: IServiceContainer;
    #environmentSettings: IEnvironmentSettings;

    #logger;

    #replies: Array<Message> = [];

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#environmentSettings = services.environmentSettings;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'OllamaStreamingReplyService');
    }

    async reply(
        message: Message,
        responseBatch: string,
        done: boolean): Promise<Message[]> {
        this.#logger(LogLevel.Info, 'Sending a streaming Discord reply...');

        const components = done ? new LargeLanguageModelActionRow(this.#services).build() : null;

        if (this.#currentReply() == null && responseBatch.length <= DiscordConstants.ContentMaxLength) {
            this.#replies.push(await message.reply({
                content: responseBatch,
                components
            }));
        } else if (this.#currentReply().content.length + responseBatch.length <= DiscordConstants.ContentMaxLength) {
            await this.#currentReply().edit({
                content: `${this.#currentReply().content}${responseBatch}`,
                components
            });
        }
        else {
            const responseBatches = splitText(responseBatch, DiscordConstants.ContentMaxLength);

            for(const response of responseBatches) {
                this.#replies.push(await message.reply({
                    content: response,
                    components
                }));
            }
        }

        return this.#replies;
    }

    clearState(): void {
        this.#replies = [];
    }

    #currentReply(): Message | null {
        if(this.#replies.length === 0) {
            return null;
        }

        return this.#replies[this.#replies.length - 1];
    }
}
